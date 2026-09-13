import { NextResponse } from "next/server";
import { verifyBookOwnership } from "@/lib/supabase/auth";
import { submitQuizAttempt } from "@/lib/quizzes/service";
import { recordStudyEvent } from "@/lib/progress/service";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

export const runtime = "nodejs";

const quizAttemptSchema = z.object({
  quizId: z.string().string().min(1, "Invalid quiz ID format"),
  bookId: z.string().string().min(1, "Invalid book ID format").optional(),
  answers: z.array(z.object({
    questionId: z.string(),
    selectedOptionId: z.string(),
  })).optional(),
  startedAt: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  completedAt: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  timeSpentSeconds: z.number().min(0).max(36000), // Max 10 hours for a quiz
  concept: z.string().max(255).optional(),
  chapterTitle: z.string().max(255).optional(),
  pageNumber: z.union([z.number(), z.string()]).refine((val) => !isNaN(Number(val)), { message: "Valid page number is required" }),
});

export const POST = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    bodySchema: quizAttemptSchema,
  },
  async ({ userId, body }) => {
    const data = body as z.infer<typeof quizAttemptSchema>;
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
    } = data;

    if (bookId) {
      const isOwner = await verifyBookOwnership(userId!, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied. You do not own this textbook." }, { status: 403 });
      }
    }

    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();

    if (end < start) {
      return NextResponse.json({ error: "Invalid timestamps provided." }, { status: 400 });
    }

    const result = await submitQuizAttempt(userId!, {
      quizId,
      bookId,
      answers: answers || [],
      startedAt,
      completedAt,
      timeSpentSeconds,
      concept,
      chapterTitle,
      pageNumber: Number(pageNumber),
    });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to record quiz attempt or quiz not found." },
        { status: 404 }
      );
    }

    await recordStudyEvent(userId!, {
      bookId,
      eventType: "quiz_completed",
      pageNumber: Number(pageNumber),
      durationSeconds: Number(timeSpentSeconds),
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
  }
);
