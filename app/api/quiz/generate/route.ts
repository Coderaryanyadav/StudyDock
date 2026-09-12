import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sanitizePromptText } from "@/lib/security/prompt-guard";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { saveQuizWithQuestions } from "@/lib/quizzes/service";
import { QuizQuestion } from "@/types";

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

    // Strict Authentication & Book Ownership Verification
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required to generate quizzes." }, { status: 401 });
    }

    if (bookId && !bookId.startsWith("demo-")) {
      const isOwner = await verifyBookOwnership(userId, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied. You do not own this textbook." }, { status: 403 });
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
          
          const formattedQuestions: QuizQuestion[] = parsed.map((item: any, idx: number) => {
            const rawOptions = Array.isArray(item.options) ? item.options : [];
            const correctIdx = typeof item.correctIndex === "number" ? item.correctIndex : 0;
            const options = rawOptions.map((opt: any, optIdx: number) => {
              if (typeof opt === "object" && opt !== null && "text" in opt) {
                return {
                  id: opt.id || `opt-${optIdx}`,
                  text: String(opt.text),
                  isCorrect: Boolean(opt.isCorrect ?? (optIdx === correctIdx)),
                };
              }
              return {
                id: `opt-${optIdx}`,
                text: String(opt),
                isCorrect: optIdx === correctIdx,
              };
            });

            return {
              id: item.id || `q-${Date.now()}-${idx}`,
              bookId: bookId || "",
              chapterId: `ch-${pageNumber || 1}`,
              pageNumber: item.pageNumber || pageNumber || 1,
              concept: item.concept || concept || "Core Concept",
              question: item.question,
              options,
              explanation: item.explanation || "",
              difficulty: (item.difficulty as "easy" | "medium" | "hard") || "medium",
            };
          });

          // Persist quiz to Supabase database
          let savedQuizId: string | null = null;
          if (bookId && formattedQuestions.length > 0) {
            savedQuizId = await saveQuizWithQuestions(
              userId,
              bookId,
              `${concept || "Textbook"} Assessment`,
              formattedQuestions
            );
          }

          return NextResponse.json({
            success: true,
            quizId: savedQuizId,
            questions: formattedQuestions,
            count: formattedQuestions.length,
            generatedFrom: "ai_context",
          });
        }
      } catch (geminiErr) {
        console.warn("Quiz generation error:", geminiErr);
        return NextResponse.json(
          { error: "Failed to generate quiz from textbook context." },
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
    console.error("Quiz API error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to generate quiz. Please try again." },
      { status: 500 }
    );
  }
}
