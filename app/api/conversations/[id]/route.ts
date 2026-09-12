import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyConversationOwnership } from "@/lib/supabase/auth";
import {
  getConversationWithMessages,
  renameConversation,
  deleteConversation,
} from "@/lib/conversations/service";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/[id]?bookId=...
 * Loads conversation record with authenticated user ownership & book scoping check.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: conversationId } = await params;
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required." }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const expectedBookId = searchParams.get("bookId") || undefined;

    const isOwner = await verifyConversationOwnership(userId, conversationId, expectedBookId);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Access denied or conversation does not exist." },
        { status: 404 }
      );
    }

    const record = await getConversationWithMessages(userId, conversationId, expectedBookId);
    if (!record) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      conversationId: record.id,
      bookId: record.bookId,
      title: record.title,
      createdAt: record.createdAt,
      messages: record.messages,
    });
  } catch (error: any) {
    console.error("GET /api/conversations/[id] error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Failed to load conversation." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/[id]
 * Renames conversation title with authenticated user ownership verification.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: conversationId } = await params;
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required." }, { status: 400 });
    }

    const body = await req.json();
    const { title, bookId } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "A valid title is required." }, { status: 400 });
    }

    const isOwner = await verifyConversationOwnership(userId, conversationId, bookId);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Access denied. You do not have permission to rename this conversation." },
        { status: 403 }
      );
    }

    const updated = await renameConversation(userId, conversationId, title, bookId);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update conversation title in database." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, conversationId, title: title.trim() });
  } catch (error: any) {
    console.error("PATCH /api/conversations/[id] error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Failed to rename conversation." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/[id]
 * Deletes conversation and cascades messages and citations with ownership check.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: conversationId } = await params;
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required." }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const expectedBookId = searchParams.get("bookId") || undefined;

    const isOwner = await verifyConversationOwnership(userId, conversationId, expectedBookId);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Access denied. You do not have permission to delete this conversation." },
        { status: 403 }
      );
    }

    const deleted = await deleteConversation(userId, conversationId, expectedBookId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete conversation from database." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, conversationId });
  } catch (error: any) {
    console.error("DELETE /api/conversations/[id] error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete conversation." },
      { status: 500 }
    );
  }
}
