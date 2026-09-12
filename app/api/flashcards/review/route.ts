import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import {
  getFlashcardsForBook,
  saveFlashcardReview,
} from "@/lib/flashcards/service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get("bookId");
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId || !bookId) {
      return NextResponse.json({ success: true, flashcards: [] });
    }

    const isOwner = await verifyBookOwnership(userId, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const flashcards = await getFlashcardsForBook(userId, bookId);
    return NextResponse.json({ success: true, flashcards });
  } catch (error: any) {
    console.error("Flashcards review GET error:", error?.message || error);
    return NextResponse.json({ success: true, flashcards: [] });
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

    const success = await saveFlashcardReview(userId, flashcardId, status);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to persist flashcard review." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, flashcardId, status });
  } catch (error: any) {
    console.error("Flashcard review error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to record flashcard review." },
      { status: 500 }
    );
  }
}
