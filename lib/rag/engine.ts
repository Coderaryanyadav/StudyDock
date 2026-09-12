import { Book, BookChunk, Citation, VideoLecture } from "@/types";

export interface SearchResultChunk {
  chunk: BookChunk;
  score: number;
}

export interface RagContext {
  activeBook: Book;
  activePageNumber: number;
  selectedText?: string;
  activeVideo?: VideoLecture;
  videoTimestampSeconds?: number;
  relevantChunks: BookChunk[];
  citations: Citation[];
  isOutOfScope: boolean;
}

/**
 * Tokenizes text and calculates term-frequency score for keyword/semantic ranking.
 */
function calculateTextScore(query: string, text: string, keyTerms: string[] = []): number {
  const queryTokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (queryTokens.length === 0) return 0;

  const lowerText = text.toLowerCase();
  let score = 0;

  // Exact phrase bonus
  if (lowerText.includes(query.toLowerCase())) {
    score += 5;
  }

  // Token matches
  for (const token of queryTokens) {
    if (lowerText.includes(token)) {
      score += 1.5;
    }
  }

  // Key terms bonus
  for (const term of keyTerms) {
    const lowerTerm = term.toLowerCase();
    for (const token of queryTokens) {
      if (lowerTerm.includes(token)) {
        score += 2.0;
      }
    }
  }

  return score;
}

/**
 * Context & RAG search engine:
 * Extracts relevant chunks from the active book based on the student's question and current reading context.
 */
export function buildRagContext(
  query: string,
  book: Book,
  activePageNumber: number,
  selectedText?: string,
  activeVideo?: VideoLecture,
  videoTimestampSeconds?: number
): RagContext {
  const chunks = book.chunks || [];
  const scoredChunks: SearchResultChunk[] = [];

  for (const chunk of chunks) {
    let score = calculateTextScore(query, chunk.text, chunk.keyTerms);

    // Boost score if the chunk belongs to the page the student is currently reading
    if (chunk.pageNumber === activePageNumber) {
      score += 3.0;
    }

    // Boost score if the student highlighted text from this chunk
    if (selectedText && chunk.text.toLowerCase().includes(selectedText.toLowerCase().slice(0, 30))) {
      score += 6.0;
    }

    if (score > 0.5) {
      scoredChunks.push({ chunk, score });
    }
  }

  // Sort descending by relevance score
  scoredChunks.sort((a, b) => b.score - a.score);

  // Take top 3 most relevant chunks
  let topChunks = scoredChunks.slice(0, 3).map((s) => s.chunk);

  // If no search matches, ensure the active page chunk is included as context
  if (topChunks.length === 0) {
    const activePageChunk = chunks.find((c) => c.pageNumber === activePageNumber);
    if (activePageChunk) {
      topChunks = [activePageChunk];
    }
  }

  // Build grounded citations from top chunks
  const citations: Citation[] = topChunks.map((chunk) => ({
    id: `cite-${chunk.id}`,
    bookId: chunk.bookId,
    bookTitle: book.title,
    chapter: chunk.chapterTitle,
    section: chunk.sectionTitle,
    pageNumber: chunk.pageNumber,
    excerpt: chunk.text.slice(0, 160) + "...",
  }));

  // Determine if question is outside the scope of the loaded textbook materials
  const maxScore = scoredChunks.length > 0 ? scoredChunks[0].score : 0;
  const isOutOfScope = maxScore < 0.8 && !selectedText;

  return {
    activeBook: book,
    activePageNumber,
    selectedText,
    activeVideo,
    videoTimestampSeconds,
    relevantChunks: topChunks,
    citations,
    isOutOfScope,
  };
}

/**
 * Constructs the structured prompt for the AI Tutor with RAG context injected.
 */
export function formatPromptForAI(
  userQuestion: string,
  context: RagContext,
  modeInstructions: string
): string {
  const activePageObj = context.activeBook.pages.find(
    (p) => p.pageNumber === context.activePageNumber
  );

  let contextPrompt = `
=== LEARNING ENVIRONMENT CONTEXT ===
- Book Title: "${context.activeBook.title}" (${context.activeBook.edition})
- Subject: ${context.activeBook.subject}
- Current Active Page: Page ${context.activePageNumber}
- Current Chapter: ${activePageObj ? activePageObj.chapterTitle : "Chapter 3: Transport Layer"}
- Current Section: ${activePageObj ? activePageObj.sectionTitle : "Section 3.3"}
`;

  if (context.selectedText) {
    contextPrompt += `\n- STUDENT HIGHLIGHTED TEXT ON PAGE ${context.activePageNumber}:\n"${context.selectedText}"\n`;
  }

  if (context.activeVideo) {
    contextPrompt += `\n- CURRENT VIDEO LECTURE: "${context.activeVideo.title}" (${context.activeVideo.channelName})\n`;
    if (context.videoTimestampSeconds !== undefined) {
      const mins = Math.floor(context.videoTimestampSeconds / 60);
      const secs = Math.floor(context.videoTimestampSeconds % 60);
      contextPrompt += `- VIDEO PLAYBACK POSITION: ${mins}:${secs.toString().padStart(2, "0")}\n`;
    }
  }

  contextPrompt += `\n=== RELEVANT TEXTBOOK EXCERPTS (GROUND TRUTH) ===\n`;
  if (context.relevantChunks.length > 0) {
    context.relevantChunks.forEach((chunk, index) => {
      contextPrompt += `\n[EXCERPT ${index + 1} - Page ${chunk.pageNumber} (${chunk.sectionTitle})]:\n${chunk.text}\n`;
    });
  } else {
    contextPrompt += `(No direct excerpt matches found in current book index)\n`;
  }

  contextPrompt += `
=== PEDAGOGICAL INSTRUCTIONS ===
Mode Objective: ${modeInstructions}

Grounded Answering Rules:
1. Prioritize the student's provided textbook excerpts. Do not hallucinate facts or invent textbook page numbers.
2. Structure your response with clear Markdown, bullet points, and KaTeX math formulas (e.g. $cwnd$, $rwnd$) where appropriate.
3. If the answer cannot be found in the provided excerpts, clearly state: "I couldn't find this in the current textbook material, but I can explain it using general knowledge."
4. Conclude with a clear citation line formatted as:
**Source: ${context.activeBook.title} — Page ${context.activePageNumber}** (or the matching excerpt page).

Student Question:
${userQuestion}
`;

  return contextPrompt;
}
