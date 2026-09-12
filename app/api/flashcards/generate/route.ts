import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sanitizePromptText } from "@/lib/security/prompt-guard";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { saveFlashcards } from "@/lib/flashcards/service";
import { Flashcard } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "local-client";
    const limitCheck = checkRateLimit(`flashcard-${ip}`, { limit: 20, windowMs: 60 * 1000 });
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit reached for flashcard generation. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { pageNumber, concept, contextText, bookId } = body;

    // Strict Authentication & Book Ownership Verification
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required to generate flashcards." }, { status: 401 });
    }

    if (bookId) {
      const isOwner = await verifyBookOwnership(userId, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied. You do not own this textbook." }, { status: 403 });
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "your_gemini_api_key_here" && contextText && contextText.length > 50) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const sanitizedContext = sanitizePromptText(contextText, 4000);
        const prompt = `You are a learning science expert. Create 4 high-yield active recall flashcards from this verified textbook passage:
Passage: "${sanitizedContext}"

Return a JSON array ONLY with this exact structure:
[
  {
    "id": "fc1",
    "front": "Front of card (Question / Term / Prompt)",
    "back": "Back of card (Concise definition / formula / key concept)",
    "concept": "${sanitizePromptText(concept || "Key Concept", 60)}",
    "chapter": "Chapter",
    "pageNumber": ${pageNumber || 1},
    "difficulty": "medium"
  }
]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          const cardInputs: Partial<Flashcard>[] = parsed.map((item: any) => ({
            bookId: bookId || "",
            chapterId: `ch-${pageNumber || 1}`,
            pageNumber: item.pageNumber || pageNumber || 1,
            concept: item.concept || concept || "Key Concept",
            question: item.front || item.question || "Concept Definition",
            answer: item.back || item.answer || "Detailed explanation",
            status: "unseen" as const,
          }));

          let savedCards: Flashcard[] = [];
          if (bookId && cardInputs.length > 0) {
            savedCards = await saveFlashcards(userId, bookId, cardInputs);
          }

          const responseCards = savedCards.length > 0 ? savedCards : cardInputs.map((c, i) => ({
            id: `fc-${Date.now()}-${i}`,
            bookId: c.bookId || "",
            chapterId: c.chapterId || `ch-${pageNumber || 1}`,
            pageNumber: c.pageNumber || pageNumber || 1,
            concept: c.concept || "Key Concept",
            question: c.question || "",
            answer: c.answer || "",
            status: c.status || "unseen",
          }));

          return NextResponse.json({
            success: true,
            flashcards: responseCards,
            count: responseCards.length,
            generatedFrom: "ai_context",
          });
        }
      } catch (geminiErr) {
        console.warn("Flashcard generation error:", geminiErr);
        return NextResponse.json(
          { error: "Failed to generate flashcards from textbook context." },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid context or AI configuration missing." },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Flashcards API error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to generate flashcards. Please try again." },
      { status: 500 }
    );
  }
}
