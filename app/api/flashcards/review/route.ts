import { NextResponse } from "next/server";
import { verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getFlashcardsForBook,
  saveFlashcardReview,
} from "@/lib/flashcards/service";
import { recordStudyEvent } from "@/lib/progress/service";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

export const runtime = "nodejs";

const flashcardsGetSchema = z.object({
  bookId: z.string().min(1, "Invalid book ID format"),
});

const flashcardsPostSchema = z.object({
  flashcardId: z.string().min(1, "Invalid flashcard ID format"),
  status: z.enum(["learning", "mastered"]),
});

export const GET = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    querySchema: flashcardsGetSchema,
  },
  async ({ userId, query }) => {
    const { bookId } = query as z.infer<typeof flashcardsGetSchema>;

    const isOwner = await verifyBookOwnership(userId!, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const flashcards = await getFlashcardsForBook(userId!, bookId);
    return NextResponse.json({ success: true, flashcards });
  }
);

export const POST = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    bodySchema: flashcardsPostSchema,
  },
  async ({ userId, body }) => {
    const { flashcardId, status } = body as z.infer<typeof flashcardsPostSchema>;

    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data: card, error: cardErr } = await supabase
        .from("flashcards")
        .select("id, user_id, book_id")
        .eq("id", flashcardId)
        .single();
      if (cardErr || !card) {
        return NextResponse.json({ error: "Flashcard not found." }, { status: 404 });
      }
      if (card.user_id !== userId) {
        return NextResponse.json({ error: "Access denied. You do not own this flashcard." }, { status: 403 });
      }
    }

    const success = await saveFlashcardReview(userId!, flashcardId, status);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to persist flashcard review." },
        { status: 500 }
      );
    }

    await recordStudyEvent(userId!, {
      eventType: "flashcard_reviewed",
      metadata: { flashcardId, status },
    }).catch(() => {});

    return NextResponse.json({ success: true, flashcardId, status });
  }
);
