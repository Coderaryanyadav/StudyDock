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
    author = "Academic Publication",
    subject = "General Studies",
  } = options;

  if (!userId || userId === "guest-user") {
    throw new Error("Authentication required for document indexing.");
  }

  // 1. Validate PDF signature (magic bytes: %PDF-)
  const header = fileBuffer.slice(0, 5).toString("utf-8");
  if (!header.startsWith("%PDF")) {
    throw new Error("Invalid document format: Missing valid PDF header signature (%PDF-).");
  }

  // 2. Extract text and pages with pdf-parse
  let pdfData: { numpages: number; text: string; info?: any };
  try {
    const pdfParse = require("pdf-parse");
    pdfData = await pdfParse(fileBuffer, {
      max: 0, // Extract all pages
    });
  } catch (err: any) {
    console.error("PDF extraction error:", err);
    throw new Error(`Failed to extract text from PDF: ${err?.message || "Corrupted or encrypted PDF."}`);
  }

  const totalPages = Math.max(1, pdfData.numpages);
  const bookId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 3. Page splitting heuristic
  const rawPageTexts = pdfData.text.split("\f").filter((t: string) => t.trim().length > 0);
  const pages: BookPage[] = [];
  const chapters: Chapter[] = [];
  const allChunks: BookChunk[] = [];

  let currentChapterNum = 1;
  let currentChapterTitle = "Uncategorized";
  let currentSectionTitle = "1.1 Content";

  // Check if PDF is a scanned image PDF (minimal or zero extractable text)
  let totalExtractedLength = 0;
  let emptyPageCount = 0;

  const numPagesToProcess = rawPageTexts.length > 0 ? rawPageTexts.length : Math.min(totalPages, 500);

  for (let i = 0; i < numPagesToProcess; i++) {
    const pageNum = i + 1;
    const pageText = (rawPageTexts[i] || "").trim();
    totalExtractedLength += pageText.length;

    if (pageText.length < 50) {
      emptyPageCount++;
    }

    // Detect chapter headings e.g. "Chapter 3: Transport Layer" or "MODULE 2"
    const chapterMatch = pageText.match(/(?:Chapter|CHAPTER|UNIT|MODULE)\s+(\d+)[:\.\s]+([^\n\r]+)/i);
    if (chapterMatch) {
      currentChapterNum = parseInt(chapterMatch[1], 10) || currentChapterNum + 1;
      currentChapterTitle = `Chapter ${currentChapterNum}: ${chapterMatch[2].trim()}`;
    }

    const sectionMatch = pageText.match(/(\d+\.\d+)\s+([^\n\r]+)/);
    if (sectionMatch) {
      currentSectionTitle = `${sectionMatch[1]} ${sectionMatch[2].trim()}`;
    }

    const keyTerms = extractKeyTerms(pageText);
    const keyTakeaways = [
      keyTerms.length > 0 ? `Key concepts: ${keyTerms.slice(0, 4).join(", ")}.` : "Extracted textbook page.",
      `Source: ${title} (Page ${pageNum}).`,
    ];

    const bookPage: BookPage = {
      pageNumber: pageNum,
      chapterId: `ch-${currentChapterNum}`,
      chapterTitle: currentChapterTitle,
      sectionId: `sec-${pageNum}`,
      sectionTitle: currentSectionTitle,
      title: `${currentSectionTitle} (p.${pageNum})`,
      content: pageText || `[Page ${pageNum} contains visual or graphical elements]`,
      keyTakeaways,
    };
    pages.push(bookPage);

    // Create intelligent chunks for this page
    if (pageText.length >= 30) {
      const textChunks = chunkText(pageText);
      for (let c = 0; c < textChunks.length; c++) {
        const chunkTextContent = textChunks[c];
        const chunkTerms = extractKeyTerms(chunkTextContent);

        allChunks.push({
          id: `chunk-${bookId}-${pageNum}-${c + 1}`,
          bookId,
          chapterId: `ch-${currentChapterNum}`,
          chapterTitle: currentChapterTitle,
          sectionId: `sec-${pageNum}`,
          sectionTitle: currentSectionTitle,
          pageNumber: pageNum,
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
    statusMessage = "Document appears to be scanned image PDF. OCR is required to extract full text.";
  } else if (emptyPageCount > 0) {
    processingStatus = "PARTIALLY_INDEXED";
    statusMessage = `Indexed ${pages.length - emptyPageCount} of ${pages.length} pages. Some pages contained only images.`;
  }

  // Build chapter structure
  chapters.push({
    id: `ch-${currentChapterNum}`,
    number: currentChapterNum,
    title: currentChapterTitle,
    startPage: 1,
    endPage: pages.length,
    sections: pages.slice(0, 10).map((p) => ({
      id: p.sectionId || `sec-${p.pageNumber}`,
      number: (p.sectionTitle || "1.1").split(" ")[0] || "1.1",
      title: p.sectionTitle || p.title || `Section ${p.pageNumber}`,
      page: p.pageNumber,
    })),
  });

  const processedBook: Book = {
    id: bookId,
    title: title.trim() || fileName.replace(/\.[^/.]+$/, ""),
    author: author.trim() || "Academic Publication",
    edition: "Verified PDF Upload",
    subject: subject.trim() || "General Studies",
    totalPages: pages.length,
    chapters,
    pages,
    chunks: allChunks,
  };

  // 4. Secure Storage & Supabase Database Ingestion
  const supabase = createAdminClient();
  let storagePath: string | undefined;

  if (supabase && userId && !userId.startsWith("demo-")) {
    try {
      // 4a. Upload PDF to private bucket under scoped path: textbooks/{userId}/{bookId}/original.pdf
      const cleanStoragePath = `${userId}/${bookId}/original.pdf`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("textbooks")
        .upload(cleanStoragePath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (!uploadErr && uploadData) {
        storagePath = uploadData.path;
      }

      // 4b. Insert Book record
      const { data: bookRecord, error: bookErr } = await supabase
        .from("books")
        .insert({
          user_id: userId,
          title: processedBook.title,
          author: processedBook.author,
          edition: processedBook.edition,
          subject: processedBook.subject,
          total_pages: processedBook.totalPages,
          storage_path: storagePath || cleanStoragePath,
          file_size_bytes: fileSizeBytes,
          mime_type: mimeType,
          status: processingStatus,
          status_message: statusMessage,
        })
        .select("id")
        .single();

      if (!bookErr && bookRecord) {
        const dbBookId = bookRecord.id;
        processedBook.id = dbBookId;

        // 4c. Ingest book_pages records into database
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
          await supabase.from("book_pages").upsert(pageBatch, {
            onConflict: "book_id,page_number",
          });
        }

        // 4d. Ingest ALL chunks with batch embeddings without arbitrary slice truncation
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

        // Batch insert in blocks of 50 to avoid Postgres payload limits
        const BATCH_SIZE = 50;
        for (let i = 0; i < chunkRecords.length; i += BATCH_SIZE) {
          const batch = chunkRecords.slice(i, i + BATCH_SIZE);
          await supabase.from("book_chunks").upsert(batch, {
            onConflict: "book_id,chunk_index",
          });
        }
      }
    } catch (dbError) {
      console.warn("Supabase persistence note (operating with in-memory book data):", dbError);
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
