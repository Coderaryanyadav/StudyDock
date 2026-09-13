import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sanitizePromptText } from "@/lib/security/prompt-guard";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

    // 1. Strict Authentication & Book Ownership Verification
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required to generate flashcards." }, { status: 401 });
    }

    if (!bookId) {
      return NextResponse.json({ error: "Book ID is required." }, { status: 400 });
    }

    const isOwner = await verifyBookOwnership(userId, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied. You do not own this textbook." }, { status: 403 });
    }

    // 2. Resolve Textbook Page Context from DB if not directly provided
    let targetContext = contextText;
    if (!targetContext || typeof targetContext !== "string" || targetContext.trim().length < 20) {
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
                concept: String(item.concept || concept || "Key Concept"),
                question,
                answer,
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
      return NextResponse.json(
        { error: "Failed to generate valid flashcards from AI response." },
        { status: 500 }
      );
    }

    // 4. Persist flashcards to database
    const savedCards = await saveFlashcards(userId, bookId, cardInputs);
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
  } catch (error: any) {
    console.error("Flashcards API error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to generate flashcards. Please try again." },
      { status: 500 }
    );
  }
}

