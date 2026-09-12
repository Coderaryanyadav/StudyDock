import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import {
  getNotesForBook,
  saveNote,
  updateNote,
  deleteNote,
} from "@/lib/notes/service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get("bookId");
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId || !bookId) {
      return NextResponse.json({ success: true, notes: [] });
    }

    if (!bookId.startsWith("demo-")) {
      const isOwner = await verifyBookOwnership(userId, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }
    }

    const notes = await getNotesForBook(userId, bookId);
    return NextResponse.json({ success: true, notes });
  } catch (error: any) {
    console.error("Notes GET error:", error?.message || error);
    return NextResponse.json({ success: true, notes: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required to create notes." }, { status: 401 });
    }

    const body = await req.json();
    const { bookId, pageNumber, selectedText, content } = body;

    if (!bookId || !content) {
      return NextResponse.json({ error: "Book ID and note content are required." }, { status: 400 });
    }

    if (!bookId.startsWith("demo-")) {
      const isOwner = await verifyBookOwnership(userId, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied. You do not own this book." }, { status: 403 });
      }
    }

    const note = await saveNote(userId, {
      bookId,
      pageNumber: pageNumber || 1,
      selectedText,
      content,
    });

    if (!note) {
      return NextResponse.json({ error: "Failed to persist note." }, { status: 500 });
    }

    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    console.error("Notes POST error:", error?.message || error);
    return NextResponse.json({ error: "Failed to create note." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json();
    const { id, content } = body;

    if (!id || !content) {
      return NextResponse.json({ error: "Note ID and content are required." }, { status: 400 });
    }

    const updated = await updateNote(userId, id, content);
    if (!updated) {
      return NextResponse.json({ error: "Failed to update note." }, { status: 500 });
    }

    return NextResponse.json({ success: true, note: updated });
  } catch (error: any) {
    console.error("Notes PATCH error:", error?.message || error);
    return NextResponse.json({ error: "Failed to update note." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Note ID is required." }, { status: 400 });
    }

    const deleted = await deleteNote(userId, id);
    if (!deleted) {
      return NextResponse.json({ error: "Failed to delete note." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Notes DELETE error:", error?.message || error);
    return NextResponse.json({ error: "Failed to delete note." }, { status: 500 });
  }
}
