import { Book, BookChunk, BookPage, Chapter, Section } from "@/types";
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
 * Validates PDF file signature, MIME type, extension, and file size constraints.
 */
export function validatePdfFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): { isValid: boolean; error?: string; format?: string } {
  if (!fileBuffer || fileBuffer.length === 0) {
    return { isValid: false, error: "Zero-byte or empty file." };
  }

  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (fileBuffer.length > MAX_SIZE) {
    return { isValid: false, error: "File exceeds maximum permitted size of 50MB." };
  }

  const cleanName = fileName.toLowerCase().trim();
  if (!cleanName.endsWith(".pdf")) {
    return { isValid: false, error: "File does not have a valid .pdf extension." };
  }

  const cleanMime = (mimeType || "").toLowerCase();
  const isPdfMime = cleanMime === "application/pdf" || cleanMime === "application/x-pdf" || cleanMime === "";
  if (!isPdfMime) {
    return { isValid: false, error: `Invalid MIME type (${mimeType}). Only PDF documents are supported.` };
  }

  const header = fileBuffer.slice(0, 5).toString("utf-8");
  if (!header.startsWith("%PDF")) {
    return { isValid: false, error: "Missing valid PDF header signature (%PDF-)." };
  }

  return { isValid: true, format: header };
}

/**
 * Extracts key domain terms from text without common stopwords.
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
 * Splits text into intelligent chunks with sentence preservation and overlap.
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

interface DetectedSection {
  number: string;
  title: string;
  pageNumber: number;
  dbId?: string;
}

interface DetectedChapter {
  number: number;
  title: string;
  startPage: number;
  endPage: number;
  sections: DetectedSection[];
  dbId?: string;
}

/**
 * Production-backed PDF Ingestion Pipeline:
 * UPLOAD -> VALIDATE -> CREATE BOOK -> STORE ORIGINAL PDF -> EXTRACT PDF ->
 * DETECT CHAPTERS -> DETECT SECTIONS -> INSERT PAGES -> INSERT CHUNKS ->
 * GENERATE GEMINI EMBEDDINGS -> STORE EMBEDDINGS IN PGVECTOR -> VERIFY PERSISTENCE -> READY
 * 
 * Strict fail-closed error handling: on any failure, marks status FAILED with diagnostic message.
 */
export async function processPdfDocument(options: ProcessDocumentOptions): Promise<ProcessedDocumentResult> {
  const {
    fileBuffer,
    fileName,
    fileSizeBytes,
    mimeType,
    userId,
    title,
    author,
    subject,
  } = options;

  if (!userId || userId === "guest-user") {
    throw new Error("Authentication required for document indexing.");
  }

  // 1. VALIDATE PDF file signature and constraints
  const validation = validatePdfFile(fileBuffer, fileName, mimeType);
  if (!validation.isValid) {
    throw new Error(`PDF validation failed: ${validation.error}`);
  }

  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("Database service unavailable. Cannot initiate PDF ingestion.");
  }

  const cleanTitle = title.trim() || fileName.replace(/\.[^/.]+$/, "");
  const cleanAuthor = author?.trim() || "Unknown Author";
  const cleanSubject = subject?.trim() || "General Studies";

  let dbBookId: string | null = null;

  try {
    // 2. CREATE BOOK record with initial status UPLOADING
    const { data: initialBook, error: bookCreateErr } = await supabase
      .from("books")
      .insert({
        user_id: userId,
        title: cleanTitle,
        author: cleanAuthor,
        edition: "1st Edition",
        subject: cleanSubject,
        total_pages: 0,
        storage_path: null,
        file_size_bytes: fileSizeBytes,
        mime_type: "application/pdf",
        status: "UPLOADING",
        status_message: "Uploading original PDF to private cloud storage...",
      })
      .select("id")
      .single();

    if (bookCreateErr || !initialBook) {
      console.error("Failed to create initial book record:", bookCreateErr);
      throw new Error(`Database error creating book record: ${bookCreateErr?.message || "Insert failed"}`);
    }

    const currentBookId: string = initialBook.id;
    dbBookId = currentBookId;

    // 3. STORE ORIGINAL PDF privately in Supabase Storage
    const cleanStoragePath = `${userId}/${currentBookId}/original.pdf`;
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from("textbooks")
      .upload(cleanStoragePath, fileBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr || !uploadData) {
      console.error("Storage upload failed:", uploadErr);
      await supabase
        .from("books")
        .update({
          status: "FAILED",
          status_message: "Failed to store PDF document in cloud storage.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentBookId);
      throw new Error(`Failed to store PDF document in cloud storage: ${uploadErr?.message || "Storage error"}`);
    }

    const storagePath = uploadData.path || cleanStoragePath;

    // Update storage_path on book record
    await supabase
      .from("books")
      .update({
        storage_path: storagePath,
        status: "PROCESSING",
        status_message: "Extracting page text and analyzing textbook structure...",
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentBookId);

    // 4. EXTRACT PDF page-by-page
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
    } catch (parseErr: any) {
      console.error("PDF text extraction error:", parseErr);
      await supabase
        .from("books")
        .update({
          status: "FAILED",
          status_message: `Text extraction failed: ${parseErr?.message || "Corrupted or encrypted PDF."}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentBookId);
      throw new Error(`Failed to extract text from PDF: ${parseErr?.message || "Corrupted or encrypted PDF."}`);
    }

    const totalPages = detectedTotalPages;

    // Update total_pages in database
    await supabase
      .from("books")
      .update({
        total_pages: totalPages,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentBookId);

    // 5. DETECT CHAPTERS & SECTIONS
    const detectedChapters: DetectedChapter[] = [];
    let currentChapter: DetectedChapter | null = null;
    let totalExtractedLength = 0;
    let emptyPageCount = 0;

    for (let i = 1; i <= totalPages; i++) {
      const pageObj = pageTexts.find((p) => p.pageNum === i);
      const pageText = pageObj ? pageObj.text : "";
      totalExtractedLength += pageText.length;

      if (pageText.length < 30) {
        emptyPageCount++;
      }

      // Detect chapter headings
      const chapterMatch = pageText.match(/(?:Chapter|CHAPTER|UNIT|MODULE)\s+(\d+)[:\.\s]+([^\n\r]+)/i);
      if (chapterMatch) {
        const num = parseInt(chapterMatch[1], 10) || (detectedChapters.length + 1);
        const chTitle = `Chapter ${num}: ${chapterMatch[2].trim()}`;

        if (currentChapter) {
          currentChapter.endPage = i - 1;
        }

        currentChapter = {
          number: num,
          title: chTitle,
          startPage: i,
          endPage: totalPages,
          sections: [],
        };
        detectedChapters.push(currentChapter);
      }

      // Detect section headings
      const sectionMatch = pageText.match(/(\d+\.\d+)[:\.\s]+([^\n\r]+)/);
      if (sectionMatch) {
        const secNum = sectionMatch[1];
        const secTitle = `${secNum} ${sectionMatch[2].trim()}`;
        const secObj: DetectedSection = {
          number: secNum,
          title: secTitle,
          pageNumber: i,
        };

        if (currentChapter) {
          currentChapter.sections.push(secObj);
        }
      }
    }

    if (currentChapter) {
      currentChapter.endPage = totalPages;
    }

    // Scanned PDF / OCR required check: Do NOT proceed to ready if scanned/image-only
    const isScannedPdf = totalExtractedLength < 100 || (emptyPageCount / totalPages) > 0.8;
    if (isScannedPdf) {
      const ocrMessage = "Your PDF is image-based and requires OCR before AI search can work.";
      await supabase
        .from("books")
        .update({
          status: "OCR_REQUIRED",
          status_message: ocrMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentBookId);

      const ocrBook: Book = {
        id: currentBookId,
        title: cleanTitle,
        author: cleanAuthor,
        edition: "1st Edition",
        subject: cleanSubject,
        totalPages,
        chapters: [],
        pages: [],
        chunks: [],
      };

      return {
        book: ocrBook,
        chunksCount: 0,
        pagesCount: totalPages,
        storagePath,
        status: "OCR_REQUIRED",
        statusMessage: ocrMessage,
        isScannedPdf: true,
      };
    }

    // 6. Ingest Chapters into database
    const finalChapters: Chapter[] = [];
    for (const ch of detectedChapters) {
      const { data: chRecord, error: chErr } = await supabase
        .from("chapters")
        .insert({
          book_id: currentBookId,
          number: ch.number,
          title: ch.title,
          start_page: ch.startPage,
          end_page: ch.endPage,
        })
        .select("id")
        .single();

      if (chErr || !chRecord) {
        console.error("Chapter insertion error:", chErr);
        throw new Error(`Database error saving chapters: ${chErr?.message}`);
      }

      ch.dbId = chRecord.id;

      // Ingest Sections for this chapter
      const finalSections: Section[] = [];
      if (ch.sections.length > 0) {
        for (const sec of ch.sections) {
          const { data: secRecord, error: secErr } = await supabase
            .from("sections")
            .insert({
              chapter_id: ch.dbId,
              number: sec.number,
              title: sec.title,
              page_number: sec.pageNumber,
            })
            .select("id")
            .single();

          if (secErr || !secRecord) {
            console.error("Section insertion error:", secErr);
            throw new Error(`Database error saving sections: ${secErr?.message}`);
          }

          sec.dbId = secRecord.id;
          finalSections.push({
            id: secRecord.id,
            chapterId: ch.dbId,
            number: sec.number,
            title: sec.title,
            page: sec.pageNumber,
            pageNumber: sec.pageNumber,
          });
        }
      }

      finalChapters.push({
        id: chRecord.id,
        bookId: currentBookId,
        number: ch.number,
        title: ch.title,
        startPage: ch.startPage,
        endPage: ch.endPage,
        sections: finalSections,
      });
    }

    // 7. Ingest Pages linking foreign keys to chapters and sections
    const pagesToInsert = [];
    for (let i = 1; i <= totalPages; i++) {
      const pageObj = pageTexts.find((p) => p.pageNum === i);
      const pageText = pageObj ? pageObj.text : "";

      // Find matching chapter by page boundary
      const matchingChapter = detectedChapters.find(
        (c) => i >= c.startPage && i <= c.endPage
      );
      const chapterId = matchingChapter?.dbId || null;
      const chapterTitle = matchingChapter?.title || null;

      // Find matching section on this page or within active chapter
      let matchingSection: DetectedSection | undefined;
      if (matchingChapter) {
        const activeSections = matchingChapter.sections.filter((s) => s.pageNumber <= i);
        if (activeSections.length > 0) {
          matchingSection = activeSections[activeSections.length - 1];
        }
      }
      const sectionId = matchingSection?.dbId || null;
      const sectionTitle = matchingSection?.title || null;

      const keyTerms = pageText ? extractKeyTerms(pageText) : [];
      const keyTakeaways = keyTerms.length > 0 ? [`Key concepts: ${keyTerms.slice(0, 4).join(", ")}.`] : [];
      const pageTitle = sectionTitle || (chapterTitle ? `${chapterTitle} (p.${i})` : `Page ${i}`);

      pagesToInsert.push({
        book_id: currentBookId,
        chapter_id: chapterId,
        section_id: sectionId,
        page_number: i,
        title: pageTitle,
        content: pageText,
        key_takeaways: keyTakeaways,
        equations: [],
        _chapterTitle: chapterTitle,
        _sectionTitle: sectionTitle,
        _pageText: pageText,
      });
    }

    // Batch insert book_pages
    const pageIdByNumber = new Map<number, string>();
    const finalPages: BookPage[] = [];

    const PAGE_BATCH_SIZE = 50;
    for (let i = 0; i < pagesToInsert.length; i += PAGE_BATCH_SIZE) {
      const batch = pagesToInsert.slice(i, i + PAGE_BATCH_SIZE);
      const dbPayload = batch.map((p) => ({
        book_id: p.book_id,
        chapter_id: p.chapter_id,
        section_id: p.section_id,
        page_number: p.page_number,
        title: p.title,
        content: p.content,
        key_takeaways: p.key_takeaways,
        equations: p.equations,
      }));

      const { data: insertedPages, error: pageErr } = await supabase
        .from("book_pages")
        .upsert(dbPayload, { onConflict: "book_id,page_number" })
        .select("id, page_number, chapter_id, section_id, title, content, key_takeaways, equations");

      if (pageErr || !insertedPages) {
        console.error("Page insertion error:", pageErr);
        throw new Error(`Database error saving page records: ${pageErr?.message || "Page insert error"}`);
      }

      for (const ip of insertedPages) {
        pageIdByNumber.set(ip.page_number, ip.id);
        const original = batch.find((b) => b.page_number === ip.page_number);
        finalPages.push({
          id: ip.id,
          bookId: currentBookId,
          pageNumber: ip.page_number,
          chapterId: ip.chapter_id,
          chapterTitle: original?._chapterTitle || null,
          sectionId: ip.section_id,
          sectionTitle: original?._sectionTitle || null,
          title: ip.title,
          content: ip.content,
          keyTakeaways: ip.key_takeaways,
          equations: ip.equations,
        });
      }
    }

    finalPages.sort((a, b) => a.pageNumber - b.pageNumber);

    // 8. Create and embed chunks
    const allChunks: BookChunk[] = [];
    const rawChunksToEmbed: {
      pageNumber: number;
      pageId: string;
      chapterTitle: string | null;
      sectionTitle: string | null;
      text: string;
      keyTerms: string[];
    }[] = [];

    for (const page of pagesToInsert) {
      const pageText = page._pageText;
      if (pageText && pageText.length >= 30) {
        const textChunks = chunkText(pageText);
        const pageId = pageIdByNumber.get(page.page_number);
        if (!pageId) {
          throw new Error(`Internal error: Missing page_id for page ${page.page_number}`);
        }

        for (let c = 0; c < textChunks.length; c++) {
          const chunkTextContent = textChunks[c];
          const chunkTerms = extractKeyTerms(chunkTextContent);

          rawChunksToEmbed.push({
            pageNumber: page.page_number,
            pageId,
            chapterTitle: page._chapterTitle,
            sectionTitle: page._sectionTitle,
            text: chunkTextContent,
            keyTerms: chunkTerms,
          });
        }
      }
    }

    if (rawChunksToEmbed.length > 0) {
      // Update status to EMBEDDING
      await supabase
        .from("books")
        .update({
          status: "EMBEDDING",
          status_message: "Generating semantic vector embeddings for textbook chunks...",
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentBookId);

      const chunkTexts = rawChunksToEmbed.map((c) => c.text);
      let embeddings: number[][] = [];

      try {
        embeddings = await generateBatchEmbeddings(chunkTexts, 5);
      } catch (embErr: any) {
        console.error("Vector embedding generation error:", embErr);
        await supabase
          .from("books")
          .update({
            status: "FAILED",
            status_message: `Embedding generation failed: ${embErr?.message || "AI service error"}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentBookId);
        throw new Error(`Failed to generate embeddings: ${embErr?.message || "AI service error"}`);
      }

      const chunkRecords = rawChunksToEmbed.map((chunk, idx) => ({
        book_id: currentBookId,
        page_id: chunk.pageId,
        chunk_index: idx,
        page_number: chunk.pageNumber,
        chapter_title: chunk.chapterTitle || null,
        section_title: chunk.sectionTitle || null,
        text: chunk.text,
        key_terms: chunk.keyTerms || [],
        embedding: `[${(embeddings[idx] || []).join(",")}]`,
      }));

      const CHUNK_BATCH_SIZE = 50;
      for (let i = 0; i < chunkRecords.length; i += CHUNK_BATCH_SIZE) {
        const batch = chunkRecords.slice(i, i + CHUNK_BATCH_SIZE);
        const { data: insertedChunks, error: chunkErr } = await supabase
          .from("book_chunks")
          .upsert(batch, { onConflict: "book_id,chunk_index" })
          .select("id, page_id, chunk_index, page_number, chapter_title, section_title, text, key_terms");

        if (chunkErr) {
          console.error("Chunk insertion error:", chunkErr);
          throw new Error(`Database error saving vector search chunks: ${chunkErr.message}`);
        }

        if (insertedChunks) {
          for (const ic of insertedChunks) {
            allChunks.push({
              id: ic.id,
              bookId: currentBookId,
              pageId: ic.page_id,
              chapterTitle: ic.chapter_title,
              sectionTitle: ic.section_title,
              pageNumber: ic.page_number,
              text: ic.text,
              keyTerms: ic.key_terms || [],
            });
          }
        }
      }
    }

    // 9. VERIFY PERSISTENCE (Fail-Closed Check)
    const [{ count: verifyPagesCount, error: vpErr }, { count: verifyChunksCount, error: vcErr }] = await Promise.all([
      supabase.from("book_pages").select("id", { count: "exact", head: true }).eq("book_id", currentBookId),
      supabase.from("book_chunks").select("id", { count: "exact", head: true }).eq("book_id", currentBookId),
    ]);

    if (vpErr || (verifyPagesCount !== null && verifyPagesCount !== totalPages)) {
      throw new Error(`Persistence verification failed: expected ${totalPages} pages in DB, found ${verifyPagesCount}`);
    }

    if (vcErr || (rawChunksToEmbed.length > 0 && verifyChunksCount !== allChunks.length)) {
      throw new Error(`Persistence verification failed: expected ${allChunks.length} chunks in DB, found ${verifyChunksCount}`);
    }

    // 10. READY: Only set status READY after all required stages and verifications succeed
    const readyStatusMessage = emptyPageCount > 0
      ? `Indexed ${totalPages - emptyPageCount} of ${totalPages} pages. Some pages contained only images.`
      : "Document successfully parsed and indexed for RAG.";

    await supabase
      .from("books")
      .update({
        status: "READY",
        status_message: readyStatusMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentBookId);

    const processedBook: Book = {
      id: currentBookId,
      title: cleanTitle,
      author: cleanAuthor,
      edition: "1st Edition",
      subject: cleanSubject,
      totalPages: finalPages.length,
      chapters: finalChapters,
      pages: finalPages,
      chunks: allChunks,
    };

    return {
      book: processedBook,
      chunksCount: allChunks.length,
      pagesCount: finalPages.length,
      storagePath,
      status: "READY",
      statusMessage: readyStatusMessage,
      isScannedPdf: false,
    };
  } catch (error: any) {
    console.error("PDF Processing pipeline error:", error);

    if (dbBookId) {
      try {
        await supabase
          .from("books")
          .update({
            status: "FAILED",
            status_message: `Processing failed: ${error?.message || "Internal ingestion error"}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", dbBookId);
      } catch (markFailedErr) {
        console.error("Failed to mark book as FAILED:", markFailedErr);
      }
    }

    throw error;
  }
}
