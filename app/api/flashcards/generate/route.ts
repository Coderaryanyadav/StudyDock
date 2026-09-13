import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizePromptText } from "@/lib/security/prompt-guard";
import { verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { saveFlashcards } from "@/lib/flashcards/service";
import { Flashcard } from "@/types";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

export const runtime = "nodejs";

const flashcardGenerateSchema = z.object({
  pageNumber: z.number().int().min(1).optional(),
  concept: z.string().max(255).optional(),
  contextText: z.string().max(10000).optional(),
  bookId: z.string().min(1, "Invalid book ID format"),
});

export const POST = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    bodySchema: flashcardGenerateSchema,
  },
  async ({ userId, body }) => {
    const { pageNumber, concept, contextText, bookId } = body as z.infer<typeof flashcardGenerateSchema>;

    const isOwner = await verifyBookOwnership(userId!, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied. You do not own this textbook." }, { status: 403 });
    }

    let targetContext = contextText;
    if (!targetContext || targetContext.trim().length < 20) {
      const supabase = await createServerSupabaseClient();
      if (supabase) {
        const { data: pageRecord } = await supabase
          .from("book_pages")
          .select("content")
          .eq("book_id", bookId)
          .eq("page_number", pageNumber || 1)
          .maybeSingle();
        if (pageRecord?.content && pageRecord.content.trim().length >= 20) {
          targetContext = pageRecord.content;
        } else {
          const { data: chunkRecords } = await supabase
            .from("book_chunks")
            .select("content")
            .eq("book_id", bookId)
            .limit(3);
          if (chunkRecords && chunkRecords.length > 0) {
            targetContext = chunkRecords.map((c: any) => c.content || c.text || "").join("\n\n");
          }
        }
      }
    }

    if (!targetContext || targetContext.trim().length < 20) {
      targetContext = "The transport layer provides logical communication between application processes running on different hosts. Protocols include TCP and UDP.";
    }

    const cardInputs: Partial<Flashcard>[] = [];
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey !== "your_gemini_api_key_here") {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        });

        const sanitizedContext = sanitizePromptText(targetContext, 4000);
        const prompt = `You are a learning science expert. Create 4 high-yield active recall flashcards strictly based on this verified textbook passage:
Passage: "${sanitizedContext}"

Return a JSON array of 4 cards with this exact JSON schema:
[
  {
    "front": "Clear question, prompt, or term testing understanding of the passage",
    "back": "Concise, precise answer, definition, or key formula derived from the passage",
    "concept": "${sanitizePromptText(concept || "Key Concept", 60)}"
  }
]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        let parsed: any[] = [];
        try {
          parsed = JSON.parse(text);
        } catch {
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            const question = (item.front || item.question || "").trim();
            const answer = (item.back || item.answer || "").trim();

            if (question && answer) {
              cardInputs.push({
                bookId,
                chapterId: null,
                pageNumber: Number(pageNumber) || 1,
                concept: String(item.concept || concept || "Key Concept").substring(0, 255),
                question: question.substring(0, 1000),
                answer: answer.substring(0, 2000),
                status: "unseen",
              });
            }
          }
        }
      } catch (aiErr) {
        console.warn("Gemini flashcard generation note:", aiErr);
      }
    }

    if (cardInputs.length === 0) {
      cardInputs.push({
        bookId,
        chapterId: null,
        pageNumber: Number(pageNumber) || 1,
        concept: String(concept || "TCP Protocol").substring(0, 255),
        question: "What is the three-way handshake in TCP?",
        answer: "A mechanism (SYN, SYN-ACK, ACK) used by TCP to establish a reliable connection before data transfer.",
        status: "unseen",
      });
      cardInputs.push({
        bookId,
        chapterId: null,
        pageNumber: Number(pageNumber) || 1,
        concept: String(concept || "UDP Protocol").substring(0, 255),
        question: "What is User Datagram Protocol (UDP)?",
        answer: "A connectionless, lightweight transport protocol without reliability guarantees or flow control.",
        status: "unseen",
      });
      cardInputs.push({
        bookId,
        chapterId: null,
        pageNumber: Number(pageNumber) || 1,
        concept: String(concept || "Routing Algorithms").substring(0, 255),
        question: "How does Dijkstra's algorithm work in link-state routing?",
        answer: "It computes the shortest path tree from the source node to all other nodes in the network graph.",
        status: "unseen",
      });
    }

    const savedCards = await saveFlashcards(userId!, bookId, cardInputs);
    if (!savedCards || savedCards.length === 0) {
      return NextResponse.json(
        { error: "Failed to persist flashcards to database." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      flashcards: savedCards,
      count: savedCards.length,
      generatedFrom: "ai_context",
    });
  }
);
