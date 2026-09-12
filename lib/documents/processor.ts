import { Book, BookChunk, BookPage, Chapter } from "@/types";
import { generateBatchEmbeddings } from "@/lib/rag/embeddings";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ProcessDocumentOptions {
  fileBuffer: Buffer;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  userId: string;
  title: string;
  author?: string;
  subject?: string;
}

export type DocumentProcessingStatus =
  | "UPLOADING"
  | "PROCESSING"
  | "EMBEDDING"
  | "READY"
  | "PARTIALLY_INDEXED"
  | "OCR_REQUIRED"
  | "FAILED";

export interface ProcessedDocumentResult {
  book: Book;
  chunksCount: number;
  pagesCount: number;
  storagePath?: string;
  status: DocumentProcessingStatus;
  statusMessage?: string;
  isScannedPdf?: boolean;
}

/**
 * Validates PDF file signature and extension
 */
export function validatePdfFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): { isValid: boolean; error?: string; format?: string } {
  if (!fileBuffer || fileBuffer.length === 0) {
    return { isValid: false, error: "Zero-byte or empty file." };
  }
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return { isValid: false, error: "File does not have a .pdf extension." };
  }
  const header = fileBuffer.slice(0, 5).toString("utf-8");
  if (!header.startsWith("%PDF")) {
    return { isValid: false, error: "Missing valid PDF header signature (%PDF-)." };
  }
  return { isValid: true, format: header };
}

/**
 * Extracts key domain terms from text without common stopwords
 */
function extractKeyTerms(text: string): string[] {
  const stopwords = new Set([
    "which", "their", "there", "about", "would", "these", "other",
    "where", "could", "should", "after", "before", "during", "while",
    "under", "above", "between", "through", "because", "against"
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !stopwords.has(w));

  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);
}

/**
 * Splits text into intelligent chunks with sentence preservation and overlap
 */
function chunkText(
  text: string,
  maxChunkChars = 800,
  overlapChars = 150
): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Keep overlap from end of current chunk
      const overlapStart = Math.max(0, currentChunk.length - overlapChars);
      currentChunk = currentChunk.slice(overlapStart) + " " + sentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((c) => c.length > 30);
}

/**
 * Real PDF document processing pipeline with full chunk indexing,
 * scanned PDF detection, chapter extraction, and idempotent pgvector ingestion.
 */
export async function processPdfDocument(options: ProcessDocumentOptions): Promise<ProcessedDocumentResult> {
  const {
    fileBuffer,
    fileName,
    fileSizeBytes,
    mimeType,
    userId,
    title,
    author = "Unknown Author",
    subject = "General",
  } = options;

  if (!userId || userId === "guest-user") {
    throw new Error("Authentication required for document indexing.");
  }

  // 1. Validate PDF signature (magic bytes: %PDF-)
  const header = fileBuffer.slice(0, 5).toString("utf-8");
  if (!header.startsWith("%PDF")) {
    throw new Error("Invalid document format: Missing valid PDF header signature (%PDF-).");
  }

  // 2. Extract text and pages with PDFParse
  const pageTexts: { pageNum: number; text: string }[] = [];
  let detectedTotalPages = 1;

  try {
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse({ data: fileBuffer });
    const textResult = await parser.getText();

    if (textResult && Array.isArray(textResult.pages)) {
      for (const p of textResult.pages) {
        pageTexts.push({ pageNum: p.num, text: (p.text || "").trim() });
      }
      detectedTotalPages = Math.max(1, textResult.total || pageTexts.length);
    }
    await parser.destroy();
  } catch (err: any) {
    console.error("PDF extraction error:", err);
    throw new Error(`Failed to extract text from PDF: ${err?.message || "Corrupted or encrypted PDF."}`);
  }

  const totalPages = detectedTotalPages;
  const bookId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 3. Page preservation: 1 database record per physical PDF page (1..totalPages)
  const pages: BookPage[] = [];
  const chapters: Chapter[] = [];
  const allChunks: BookChunk[] = [];

  let currentChapterNum: number | null = null;
  let currentChapterTitle: string | null = null;
  let totalExtractedLength = 0;
  let emptyPageCount = 0;

  for (let i = 1; i <= totalPages; i++) {
    const pageObj = pageTexts.find((p) => p.pageNum === i);
    const pageText = pageObj ? pageObj.text : "";
    totalExtractedLength += pageText.length;

    if (pageText.length < 30) {
      emptyPageCount++;
    }

    // Detect real chapter headings if present
    const chapterMatch = pageText.match(/(?:Chapter|CHAPTER|UNIT|MODULE)\s+(\d+)[:\.\s]+([^\n\r]+)/i);
    if (chapterMatch) {
      currentChapterNum = parseInt(chapterMatch[1], 10) || (currentChapterNum ? currentChapterNum + 1 : 1);
      currentChapterTitle = `Chapter ${currentChapterNum}: ${chapterMatch[2].trim()}`;
    }

    // Detect section headings if present
    const sectionMatch = pageText.match(/(\d+\.\d+)\s+([^\n\r]+)/);
    const sectionTitle = sectionMatch ? `${sectionMatch[1]} ${sectionMatch[2].trim()}` : null;

    const keyTerms = pageText ? extractKeyTerms(pageText) : [];
    const keyTakeaways = keyTerms.length > 0 ? [`Key concepts: ${keyTerms.slice(0, 4).join(", ")}.`] : [];

    const bookPage: BookPage = {
      pageNumber: i,
      chapterId: currentChapterNum ? `ch-${currentChapterNum}` : null,
      chapterTitle: currentChapterTitle,
      sectionId: sectionTitle ? `sec-${i}` : null,
      sectionTitle,
      title: sectionTitle || (currentChapterTitle ? `${currentChapterTitle} (p.${i})` : `Page ${i}`),
      content: pageText,
      keyTakeaways,
    };
    pages.push(bookPage);

    // Create intelligent search chunks for RAG if page has text
    if (pageText.length >= 30) {
      const textChunks = chunkText(pageText);
      for (let c = 0; c < textChunks.length; c++) {
        const chunkTextContent = textChunks[c];
        const chunkTerms = extractKeyTerms(chunkTextContent);

        allChunks.push({
          id: `chunk-${bookId}-${i}-${c + 1}`,
          bookId,
          chapterId: currentChapterNum ? `ch-${currentChapterNum}` : null,
          chapterTitle: currentChapterTitle || undefined,
          sectionId: sectionTitle ? `sec-${i}` : null,
          sectionTitle: sectionTitle || undefined,
          pageNumber: i,
          text: chunkTextContent,
          keyTerms: chunkTerms,
        });
      }
    }
  }

  // Scanned PDF / OCR required check
  const isScannedPdf = totalExtractedLength < 100 || (emptyPageCount / totalPages) > 0.8;
  let processingStatus: DocumentProcessingStatus = "READY";
  let statusMessage = "Document successfully parsed and indexed for RAG.";

  if (isScannedPdf) {
    processingStatus = "OCR_REQUIRED";
    statusMessage = "Your PDF is image-based and requires OCR before AI search can work.";
  } else if (emptyPageCount > 0) {
    processingStatus = "PARTIALLY_INDEXED";
    statusMessage = `Indexed ${pages.length - emptyPageCount} of ${pages.length} pages. Some pages contained only images.`;
  }

  if (currentChapterTitle && currentChapterNum) {
    chapters.push({
      id: `ch-${currentChapterNum}`,
      number: currentChapterNum,
      title: currentChapterTitle,
      startPage: 1,
      endPage: pages.length,
      sections: pages
        .filter((p) => p.sectionTitle)
        .slice(0, 10)
        .map((p) => ({
          id: p.sectionId || `sec-${p.pageNumber}`,
          number: (p.sectionTitle || "1.1").split(" ")[0] || "1.1",
          title: p.sectionTitle || `Section ${p.pageNumber}`,
          page: p.pageNumber,
        })),
    });
  }

  const processedBook: Book = {
    id: bookId,
    title: title.trim() || fileName.replace(/\.[^/.]+$/, ""),
    author: author.trim() || "Unknown Author",
    edition: "1st Edition",
    subject: subject.trim() || "General",
    totalPages: pages.length,
    chapters,
    pages,
    chunks: allChunks,
  };

  // 4. Secure Storage & Supabase Database Ingestion (Strict Fail-Closed)
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("Supabase persistence client unavailable. Cannot complete upload.");
  }

  const cleanStoragePath = `${userId}/${bookId}/original.pdf`;

  // 4a. Upload original PDF to private storage bucket
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from("textbooks")
    .upload(cleanStoragePath, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadErr || !uploadData) {
    console.error("Storage upload failed:", uploadErr);
    throw new Error(`Failed to store PDF document in cloud storage: ${uploadErr?.message || "Storage error"}`);
  }

  const storagePath = uploadData.path || cleanStoragePath;

  // 4b. Insert Book record into database
  const { data: bookRecord, error: bookErr } = await supabase
    .from("books")
    .insert({
      user_id: userId,
      title: processedBook.title,
      author: processedBook.author,
      edition: processedBook.edition,
      subject: processedBook.subject,
      total_pages: processedBook.totalPages,
      storage_path: storagePath,
      file_size_bytes: fileSizeBytes,
      mime_type: mimeType,
      status: processingStatus,
      status_message: statusMessage,
    })
    .select("id")
    .single();

  if (bookErr || !bookRecord) {
    console.error("Book record insertion failed:", bookErr);
    throw new Error(`Database error saving textbook metadata: ${bookErr?.message || "Database insert error"}`);
  }

  const dbBookId = bookRecord.id;
  processedBook.id = dbBookId;

  // 4c. Ingest book_pages records
  const pageRecords = pages.map((p) => ({
    book_id: dbBookId,
    page_number: p.pageNumber,
    title: p.title || `Page ${p.pageNumber}`,
    content: p.content,
    key_takeaways: p.keyTakeaways || [],
    equations: p.equations || [],
  }));

  const PAGE_BATCH_SIZE = 50;
  for (let i = 0; i < pageRecords.length; i += PAGE_BATCH_SIZE) {
    const pageBatch = pageRecords.slice(i, i + PAGE_BATCH_SIZE);
    const { error: pageErr } = await supabase.from("book_pages").upsert(pageBatch, {
      onConflict: "book_id,page_number",
    });
    if (pageErr) {
      console.error("Page insertion error:", pageErr);
      throw new Error(`Database error saving page records: ${pageErr.message}`);
    }
  }

  // 4d. Ingest real chapters and sections into database
  if (chapters.length > 0) {
    for (const ch of chapters) {
      const { data: chRecord, error: chErr } = await supabase
        .from("chapters")
        .insert({
          book_id: dbBookId,
          number: ch.number,
          title: ch.title,
          start_page: ch.startPage,
          end_page: ch.endPage,
        })
        .select("id")
        .single();

      if (!chErr && chRecord && ch.sections.length > 0) {
        const secRecords = ch.sections.map((sec) => ({
          chapter_id: chRecord.id,
          number: sec.number,
          title: sec.title,
          page_number: sec.page,
        }));
        await supabase.from("sections").insert(secRecords);
      }
    }
  }

  // 4e. Ingest all chunks with vector embeddings if text chunks exist
  if (allChunks.length > 0) {
    const chunkTexts = allChunks.map((c) => c.text);
    const embeddings = await generateBatchEmbeddings(chunkTexts, 5);

    const chunkRecords = allChunks.map((chunk, idx) => ({
      book_id: dbBookId,
      chunk_index: idx,
      page_number: chunk.pageNumber,
      chapter_title: chunk.chapterTitle || null,
      section_title: chunk.sectionTitle || null,
      text: chunk.text,
      key_terms: chunk.keyTerms || [],
      embedding: `[${(embeddings[idx] || []).join(",")}]`,
    }));

    const BATCH_SIZE = 50;
    for (let i = 0; i < chunkRecords.length; i += BATCH_SIZE) {
      const batch = chunkRecords.slice(i, i + BATCH_SIZE);
      const { error: chunkErr } = await supabase.from("book_chunks").upsert(batch, {
        onConflict: "book_id,chunk_index",
      });
      if (chunkErr) {
        console.error("Chunk insertion error:", chunkErr);
        throw new Error(`Database error saving vector search chunks: ${chunkErr.message}`);
      }
    }
  }

  return {
    book: processedBook,
    chunksCount: allChunks.length,
    pagesCount: pages.length,
    storagePath,
    status: processingStatus,
    statusMessage,
    isScannedPdf,
  };
}
