import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getFlashcardsForBook,
  saveFlashcardReview,
} from "@/lib/flashcards/service";
import { recordStudyEvent } from "@/lib/progress/service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get("bookId");
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!bookId) {
      return NextResponse.json({ error: "Book ID is required." }, { status: 400 });
    }

    const isOwner = await verifyBookOwnership(userId, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const flashcards = await getFlashcardsForBook(userId, bookId);
    return NextResponse.json({ success: true, flashcards });
  } catch (error: any) {
    console.error("Flashcards review GET error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch flashcards." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required to review flashcards." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { flashcardId, status } = body;

    if (!flashcardId || !status) {
      return NextResponse.json(
        { error: "Flashcard ID and status are required." },
        { status: 400 }
      );
    }

    if (status !== "learning" && status !== "mastered") {
      return NextResponse.json(
        { error: "Invalid status value. Must be 'learning' or 'mastered'." },
        { status: 400 }
      );
    }

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

    const success = await saveFlashcardReview(userId, flashcardId, status);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to persist flashcard review." },
        { status: 500 }
      );
    }

    // Log tracking event
    await recordStudyEvent(userId, {
      eventType: "flashcard_reviewed",
      metadata: { flashcardId, status },
    }).catch(() => {});

    return NextResponse.json({ success: true, flashcardId, status });
  } catch (error: any) {
    console.error("Flashcard review error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to record flashcard review." },
      { status: 500 }
    );
  }
}
