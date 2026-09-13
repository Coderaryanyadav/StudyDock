import { NextResponse } from "next/server";
import { verifyBookOwnership } from "@/lib/supabase/auth";
import {
  getNotesForBook,
  saveNote,
  updateNote,
  deleteNote,
} from "@/lib/notes/service";
import { recordStudyEvent } from "@/lib/progress/service";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

export const runtime = "nodejs";

const notesGetSchema = z.object({
  bookId: z.string().string().min(1, "Invalid book ID format"),
});

const notesPostSchema = z.object({
  bookId: z.string().string().min(1, "Invalid book ID format"),
  pageNumber: z.number().int().min(1).optional(),
  selectedText: z.string().max(10000).optional(),
  content: z.string().min(1).max(10000, "Note content exceeds maximum length"),
});

const notesPatchSchema = z.object({
  id: z.string().string().min(1, "Invalid note ID format"),
  content: z.string().min(1).max(10000, "Note content exceeds maximum length"),
});

const notesDeleteSchema = z.object({
  id: z.string().string().min(1, "Invalid note ID format"),
});

export const GET = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    querySchema: notesGetSchema,
  },
  async ({ userId, query }) => {
    const { bookId } = query as z.infer<typeof notesGetSchema>;

    const isOwner = await verifyBookOwnership(userId!, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied. You do not own this book." }, { status: 403 });
    }

    const notes = await getNotesForBook(userId!, bookId);
    return NextResponse.json({ success: true, notes });
  }
);

export const POST = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    bodySchema: notesPostSchema,
  },
  async ({ userId, body }) => {
    const { bookId, pageNumber, selectedText, content } = body as z.infer<typeof notesPostSchema>;

    const isOwner = await verifyBookOwnership(userId!, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied. You do not own this book." }, { status: 403 });
    }

    const note = await saveNote(userId!, {
      bookId,
      pageNumber: pageNumber || 1,
      selectedText,
      content,
    });

    if (!note) {
      return NextResponse.json({ error: "Failed to persist note." }, { status: 500 });
    }

    await recordStudyEvent(userId!, {
      bookId,
      eventType: "note_created",
      pageNumber: pageNumber || 1,
      metadata: { noteId: note.id },
    }).catch(() => {});

    return NextResponse.json({ success: true, note });
  }
);

export const PATCH = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    bodySchema: notesPatchSchema,
  },
  async ({ userId, body }) => {
    const { id, content } = body as z.infer<typeof notesPatchSchema>;

    const updated = await updateNote(userId!, id, content);
    if (!updated) {
      return NextResponse.json({ error: "Failed to update note or note not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, note: updated });
  }
);

export const DELETE = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    querySchema: notesDeleteSchema,
  },
  async ({ userId, query }) => {
    const { id } = query as z.infer<typeof notesDeleteSchema>;

    const deleted = await deleteNote(userId!, id);
    if (!deleted) {
      return NextResponse.json({ error: "Failed to delete note or note not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  }
);
