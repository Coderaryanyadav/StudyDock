import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { submitQuizAttempt } from "@/lib/quizzes/service";
import { recordStudyEvent } from "@/lib/progress/service";

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required to record quiz attempts." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      quizId,
      bookId,
      answers,
      startedAt,
      completedAt,
      timeSpentSeconds,
      concept,
      chapterTitle,
      pageNumber,
    } = body;

    if (!quizId) {
      return NextResponse.json({ error: "Quiz ID is required." }, { status: 400 });
    }

    if (bookId) {
      const isOwner = await verifyBookOwnership(userId, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied. You do not own this textbook." }, { status: 403 });
      }
    }

    const result = await submitQuizAttempt(userId, {
      quizId,
      bookId,
      answers: Array.isArray(answers) ? answers : [],
      startedAt,
      completedAt,
      timeSpentSeconds,
      concept,
      chapterTitle,
      pageNumber: Number(pageNumber) || 1,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to record quiz attempt or quiz not found." },
        { status: 404 }
      );
    }

    // Log tracking event
    await recordStudyEvent(userId, {
      bookId,
      eventType: "quiz_completed",
      pageNumber: Number(pageNumber) || 1,
      durationSeconds: Number(timeSpentSeconds) || 0,
      metadata: {
        quizId,
        score: result.score,
        totalQuestions: result.totalQuestions,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      attempt: result,
      score: result.score,
      totalQuestions: result.totalQuestions,
      conceptMastery: result.conceptMastery,
    });
  } catch (error: any) {
    console.error("Quiz attempt API error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to record quiz attempt." },
      { status: 500 }
    );
  }
}

