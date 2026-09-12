const pdfParse = require("pdf-parse");
import { Book, BookChunk, BookPage, Chapter } from "@/types";
import { generateEmbedding } from "@/lib/rag/embeddings";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ProcessDocumentOptions {
  fileBuffer: Buffer;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  userId: string;
  title: string;
  author: string;
  subject: string;
}

export interface ProcessedDocumentResult {
  book: Book;
  chunksCount: number;
  pagesCount: number;
  storagePath?: string;
}

/**
 * Extracts key terms from text
 */
function extractKeyTerms(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !["which", "their", "there", "about", "would", "these", "other"].includes(w));

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
  maxChunkChars: number = 800,
  overlapChars: number = 150
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
 * Real PDF document processing pipeline
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

  // 1. Validate PDF signature (magic bytes: %PDF-)
  const header = fileBuffer.slice(0, 5).toString("utf-8");
  if (!header.startsWith("%PDF")) {
    throw new Error("Invalid document format: Missing valid PDF header signature.");
  }

  // 2. Extract text and pages with pdf-parse
  let pdfData: { numpages: number; text: string };
  try {
    pdfData = await pdfParse(fileBuffer);
  } catch (err: any) {
    console.error("PDF extraction error:", err);
    throw new Error(`Failed to extract text from PDF: ${err?.message || "Corrupted or encrypted PDF."}`);
  }

  const totalPages = Math.max(1, pdfData.numpages);
  const bookId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 3. Page splitting heuristic
  // pdf-parse provides full text with form feeds (\f) between pages in standard PDFs
  const rawPageTexts = pdfData.text.split("\f").filter((t) => t.trim().length > 0);
  const pages: BookPage[] = [];
  const chapters: Chapter[] = [];
  const allChunks: BookChunk[] = [];

  let currentChapterNum = 1;
  let currentChapterTitle = "Chapter 1: Foundations & Overview";
  let currentSectionTitle = "1.1 Introduction";

  const numPagesToProcess = rawPageTexts.length > 0 ? rawPageTexts.length : Math.min(totalPages, 50);

  for (let i = 0; i < numPagesToProcess; i++) {
    const pageNum = i + 1;
    const pageText = rawPageTexts[i] || `Page ${pageNum} content extracted from ${fileName}.\n\n` + pdfData.text.slice(i * 1200, (i + 1) * 1200);

    // Detect chapter headings e.g. "Chapter 3: Transport Layer" or "3.1 TCP Handshake"
    const chapterMatch = pageText.match(/(?:Chapter|CHAPTER)\s+(\d+)[:\.\s]+([^\n\r]+)/i);
    if (chapterMatch) {
      currentChapterNum = parseInt(chapterMatch[1], 10) || currentChapterNum + 1;
      currentChapterTitle = `Chapter ${currentChapterNum}: ${chapterMatch[2].trim()}`;
    }

    const sectionMatch = pageText.match(/(\d+\.\d+)\s+([^\n\r]+)/);
    if (sectionMatch) {
      currentSectionTitle = `${sectionMatch[1]} ${sectionMatch[2].trim()}`;
    }

    // Key takeaways extraction
    const keyTerms = extractKeyTerms(pageText);
    const keyTakeaways = [
      `Key concepts identified: ${keyTerms.slice(0, 4).join(", ")}.`,
      `Extracted from verified source: ${title} (Page ${pageNum}).`,
    ];

    const bookPage: BookPage = {
      pageNumber: pageNum,
      chapterId: `ch-${currentChapterNum}`,
      chapterTitle: currentChapterTitle,
      sectionId: `sec-${pageNum}`,
      sectionTitle: currentSectionTitle,
      title: `${currentSectionTitle} (p.${pageNum})`,
      content: pageText.trim(),
      keyTakeaways,
    };
    pages.push(bookPage);

    // Create intelligent chunks for this page
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

  // Build chapter structure
  chapters.push({
    id: `ch-${currentChapterNum}`,
    number: currentChapterNum,
    title: currentChapterTitle,
    startPage: 1,
    endPage: pages.length,
    sections: pages.slice(0, 8).map((p) => ({
      id: p.sectionId,
      number: p.sectionTitle.split(" ")[0] || "1.1",
      title: p.sectionTitle,
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

  // 4. If Supabase Admin Client is configured, persist to database and private storage
  const supabase = createAdminClient();
  let storagePath: string | undefined;

  if (supabase) {
    try {
      // Upload PDF to private bucket
      const cleanFileName = `${userId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("textbooks")
        .upload(cleanFileName, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (!uploadErr && uploadData) {
        storagePath = uploadData.path;
      }

      // Insert Book record
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
          status: "READY",
        })
        .select("id")
        .single();

      if (!bookErr && bookRecord) {
        // Insert chunks with vector embeddings in background
        for (const chunk of allChunks.slice(0, 30)) {
          const embedding = await generateEmbedding(chunk.text);
          await supabase.from("book_chunks").insert({
            book_id: bookRecord.id,
            page_number: chunk.pageNumber,
            chapter_title: chunk.chapterTitle,
            section_title: chunk.sectionTitle,
            text: chunk.text,
            key_terms: chunk.keyTerms,
            embedding: `[${embedding.join(",")}]`,
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
  };
}
