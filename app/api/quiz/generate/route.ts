import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sanitizePromptText } from "@/lib/security/prompt-guard";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

    // 1. Strict Authentication & Book Ownership Verification
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required to generate quizzes." }, { status: 401 });
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

    let formattedQuestions: QuizQuestion[] = [];
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
        const prompt = `You are an academic test designer. Generate 3 multiple choice questions based strictly on this verified textbook context:
Context: "${sanitizedContext}"

Return a JSON array of 3 questions with this exact JSON schema:
[
  {
    "question": "Clear question testing understanding of the context?",
    "options": [
      { "id": "opt-0", "text": "Option A text", "isCorrect": true },
      { "id": "opt-1", "text": "Option B text", "isCorrect": false },
      { "id": "opt-2", "text": "Option C text", "isCorrect": false },
      { "id": "opt-3", "text": "Option D text", "isCorrect": false }
    ],
    "explanation": "Detailed explanation citing the textbook context why the correct answer is right.",
    "concept": "${sanitizePromptText(concept || "Core Concept", 60)}",
    "difficulty": "medium"
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
          for (let i = 0; i < parsed.length; i++) {
            const item = parsed[i];
            if (!item.question || typeof item.question !== "string") continue;

            let options: { id: string; text: string; isCorrect: boolean }[] = [];
            if (Array.isArray(item.options)) {
              options = item.options.map((opt: any, optIdx: number) => {
                if (typeof opt === "object" && opt !== null) {
                  return {
                    id: opt.id || `opt-${optIdx}`,
                    text: String(opt.text || `Option ${optIdx + 1}`),
                    isCorrect: Boolean(opt.isCorrect),
                  };
                }
                return {
                  id: `opt-${optIdx}`,
                  text: String(opt),
                  isCorrect: optIdx === (item.correctIndex ?? 0),
                };
              });
            }

            if (options.length < 2) continue;
            const correctCount = options.filter((o) => o.isCorrect).length;
            if (correctCount !== 1) continue; // Reject malformed question

            formattedQuestions.push({
              id: `q-${Date.now()}-${i}`,
              bookId,
              chapterId: null,
              pageNumber: Number(pageNumber) || 1,
              concept: String(item.concept || concept || "Core Concept"),
              question: String(item.question),
              options,
              explanation: String(item.explanation || ""),
              difficulty: (item.difficulty as "easy" | "medium" | "hard") || "medium",
            });
          }
        }
      } catch (aiErr) {
        console.warn("Gemini quiz generation note:", aiErr);
      }
    }

    if (formattedQuestions.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate a valid quiz from AI response." },
        { status: 500 }
      );
    }

    // 4. Persist quiz to database
    const savedQuizId = await saveQuizWithQuestions(
      userId,
      bookId,
      `${concept || "Textbook"} Assessment`,
      formattedQuestions
    );

    if (!savedQuizId) {
      return NextResponse.json(
        { error: "Failed to persist generated quiz to database." },
        { status: 500 }
      );
    }

    const fullQuiz = {
      id: savedQuizId,
      bookId,
      title: `${concept || "Textbook"} Assessment`,
      questions: formattedQuestions,
    };

    return NextResponse.json({
      success: true,
      quizId: savedQuizId,
      quiz: fullQuiz,
      questions: formattedQuestions,
      count: formattedQuestions.length,
      generatedFrom: "ai_context",
    });
  } catch (error: any) {
    console.error("Quiz API error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to generate quiz. Please try again." },
      { status: 500 }
    );
  }
}

