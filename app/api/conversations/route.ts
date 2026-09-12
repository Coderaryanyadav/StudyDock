import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { getConversationsForUser, createConversation } from "@/lib/conversations/service";

export const runtime = "nodejs";

/**
 * GET /api/conversations?bookId=...
 * Lists all conversations for the authenticated user and requested book.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get("bookId");

    if (!bookId) {
      return NextResponse.json({ error: "Book ID is required." }, { status: 400 });
    }

    const isOwner = await verifyBookOwnership(userId, bookId);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Access denied. You do not have permission to access conversations for this book." },
        { status: 403 }
      );
    }

    const conversations = await getConversationsForUser(userId, bookId);
    return NextResponse.json({ success: true, conversations });
  } catch (error: any) {
    console.error("GET /api/conversations error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch conversations." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * Creates a new conversation thread for the authenticated user and specified book.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json();
    const { bookId, title } = body;

    if (!bookId) {
      return NextResponse.json({ error: "Book ID is required." }, { status: 400 });
    }

    const isOwner = await verifyBookOwnership(userId, bookId);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Access denied. You do not have permission to create conversations for this book." },
        { status: 403 }
      );
    }

    const conversation = await createConversation(userId, bookId, title);
    return NextResponse.json({ success: true, conversation }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/conversations error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Failed to create conversation." },
      { status: 500 }
    );
  }
}
