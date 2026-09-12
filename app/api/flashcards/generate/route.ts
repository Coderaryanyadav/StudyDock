import { NextRequest, NextResponse } from "next/server";
import { DEMO_FLASHCARDS } from "@/lib/demo-data";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sanitizePromptText } from "@/lib/security/prompt-guard";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";

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

    // Verify ownership if custom bookId is specified
    if (bookId && !bookId.startsWith("demo-")) {
      const auth = await authenticateRequest(req);
      if (!auth?.id) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 });
      }
      const isOwner = await verifyBookOwnership(auth.id, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
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
          return NextResponse.json({
            success: true,
            flashcards: parsed,
            count: parsed.length,
            generatedFrom: "ai_context",
          });
        }
      } catch (geminiErr) {
        console.warn("Dynamic flashcard generation fallback:", geminiErr);
      }
    }

    let flashcards = DEMO_FLASHCARDS;
    if (pageNumber) {
      const filtered = DEMO_FLASHCARDS.filter((f) => f.pageNumber === pageNumber);
      if (filtered.length > 0) {
        flashcards = filtered;
      }
    }

    return NextResponse.json({
      success: true,
      flashcards,
      count: flashcards.length,
      generatedFrom: "curated_material",
    });
  } catch (error: any) {
    console.error("Flashcards API error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to generate flashcards. Please try again." },
      { status: 500 }
    );
  }
}
