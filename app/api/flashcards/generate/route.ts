import { NextRequest, NextResponse } from "next/server";
import { DEMO_FLASHCARDS } from "@/lib/demo-data";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit } from "@/lib/security/rate-limit";

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
    const { pageNumber, concept, contextText } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "your_gemini_api_key_here" && contextText && contextText.length > 50) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `You are a learning science expert. Create 4 high-yield active recall flashcards from this textbook passage:
Passage: "${contextText.slice(0, 3000)}"

Return a JSON array ONLY with this exact structure:
[
  {
    "id": "fc1",
    "front": "Front of card (Question / Term / Prompt)",
    "back": "Back of card (Concise definition / formula / key concept)",
    "concept": "${concept || "Key Concept"}",
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
    console.error("Flashcards API error:", error);
    return NextResponse.json(
      { error: "Failed to generate flashcards. Please try again." },
      { status: 500 }
    );
  }
}
