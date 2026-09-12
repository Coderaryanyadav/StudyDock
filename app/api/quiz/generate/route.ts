import { NextRequest, NextResponse } from "next/server";
import { DEMO_QUIZ_QUESTIONS } from "@/lib/demo-data";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sanitizePromptText } from "@/lib/security/prompt-guard";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "local-client";
    const limitCheck = checkRateLimit(`quiz-${ip}`, { limit: 20, windowMs: 60 * 1000 });
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit reached for quiz generation. Please wait a moment." },
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

    // Dynamic question generation from actual textbook context
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "your_gemini_api_key_here" && contextText && contextText.length > 50) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const sanitizedContext = sanitizePromptText(contextText, 4000);
        const prompt = `You are an academic test designer. Generate 3 multiple choice questions based strictly on this verified textbook context:
Context: "${sanitizedContext}"

Return a JSON array ONLY with this exact structure:
[
  {
    "id": "q1",
    "question": "Clear question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Brief explanation why option 0 is correct based on the text.",
    "concept": "${sanitizePromptText(concept || "Core Topic", 60)}",
    "pageNumber": ${pageNumber || 1}
  }
]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({
            success: true,
            questions: parsed,
            count: parsed.length,
            generatedFrom: "ai_context",
          });
        }
      } catch (geminiErr) {
        console.warn("Dynamic quiz generation fallback:", geminiErr);
      }
    }

    // Default grounded questions filtered by page/concept
    let questions = DEMO_QUIZ_QUESTIONS;
    if (pageNumber) {
      const pageMatch = DEMO_QUIZ_QUESTIONS.filter((q) => q.pageNumber === pageNumber);
      if (pageMatch.length > 0) {
        questions = pageMatch;
      }
    }

    return NextResponse.json({
      success: true,
      questions,
      count: questions.length,
      generatedFrom: "curated_material",
    });
  } catch (error: any) {
    console.error("Quiz API error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to generate quiz. Please try again." },
      { status: 500 }
    );
  }
}
