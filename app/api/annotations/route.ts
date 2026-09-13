import { NextResponse } from "next/server";
import { verifyBookOwnership } from "@/lib/supabase/auth";
import {
  getHighlightsForBook,
  getBookmarksForBook,
  saveHighlight,
  updateHighlight,
  deleteHighlight,
  saveBookmark,
  updateBookmark,
  deleteBookmark,
} from "@/lib/annotations/service";
import { recordStudyEvent } from "@/lib/progress/service";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

export const runtime = "nodejs";

const getAnnotationsSchema = z.object({
  bookId: z.string().string().min(1, "Invalid book ID format"),
});

const postAnnotationSchema = z.object({
  type: z.enum(["bookmark", "highlight"]),
  bookId: z.string().string().min(1, "Invalid book ID format"),
  pageNumber: z.number().int().min(1).optional(),
  selectedText: z.string().max(10000).optional(),
  text: z.string().max(10000).optional(),
  color: z.string().max(20).optional(),
  note: z.string().max(10000).optional(),
  title: z.string().max(255).optional(),
  boundingRect: z.any().optional(),
  positionData: z.any().optional(),
  rects: z.any().optional(),
});

const patchAnnotationSchema = z.object({
  id: z.string().string().min(1, "Invalid annotation ID format"),
  type: z.enum(["bookmark", "highlight"]).optional(),
  color: z.string().max(20).optional(),
  note: z.string().max(10000).optional(),
  title: z.string().max(255).optional(),
});

const deleteAnnotationSchema = z.object({
  id: z.string().string().min(1, "Invalid annotation ID format").optional(),
  type: z.enum(["bookmark", "highlight"]).optional(),
  bookId: z.string().string().min(1, "Invalid book ID format").optional(),
  pageNumber: z.union([z.number(), z.string()]).optional(),
});

export const GET = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    querySchema: getAnnotationsSchema,
  },
  async ({ userId, query }) => {
    const { bookId } = query as z.infer<typeof getAnnotationsSchema>;

    const isOwner = await verifyBookOwnership(userId!, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied. You do not own this book." }, { status: 403 });
    }

    const [highlights, bookmarks] = await Promise.all([
      getHighlightsForBook(userId!, bookId),
      getBookmarksForBook(userId!, bookId),
    ]);

    return NextResponse.json({
      success: true,
      highlights,
      bookmarks,
    });
  }
);

export const POST = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    bodySchema: postAnnotationSchema,
  },
  async ({ userId, body }) => {
    const data = body as z.infer<typeof postAnnotationSchema>;
    const type = data.type;
    const bookId = data.bookId;
    const pageNumber = data.pageNumber;
    const text = data.text || data.selectedText;
    const color = data.color;
    const note = data.note;
    const title = data.title;
    const boundingRect = data.boundingRect || data.positionData?.boundingRect;
    const rects = data.rects || data.positionData?.rects;

    const isOwner = await verifyBookOwnership(userId!, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied. You do not own this textbook." }, { status: 403 });
    }

    if (type === "bookmark") {
      const bookmark = await saveBookmark(userId!, {
        bookId,
        pageNumber: pageNumber || 1,
        title,
      });

      if (!bookmark) {
        return NextResponse.json({ error: "Failed to save bookmark." }, { status: 500 });
      }

      await recordStudyEvent(userId!, {
        bookId,
        eventType: "bookmark_created",
        pageNumber: pageNumber || 1,
        metadata: { bookmarkId: bookmark.id, title },
      }).catch(() => {});

      return NextResponse.json({ success: true, id: bookmark.id, type: "bookmark", bookmark });
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Missing required highlight text." }, { status: 400 });
    }

    const highlight = await saveHighlight(userId!, {
      bookId,
      pageNumber: pageNumber || 1,
      text: text.trim(),
      color,
      note,
      boundingRect,
      rects,
    });

    if (!highlight) {
      return NextResponse.json({ error: "Failed to save highlight." }, { status: 500 });
    }

    await recordStudyEvent(userId!, {
      bookId,
      eventType: "highlight_created",
      pageNumber: pageNumber || 1,
      metadata: { highlightId: highlight.id, color },
    }).catch(() => {});

    return NextResponse.json({ success: true, id: highlight.id, type: "highlight", highlight });
  }
);

export const PATCH = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    bodySchema: patchAnnotationSchema,
  },
  async ({ userId, body }) => {
    const data = body as z.infer<typeof patchAnnotationSchema>;

    if (data.type === "bookmark") {
      if (!data.title) {
        return NextResponse.json({ error: "Title is required to update bookmark." }, { status: 400 });
      }
      const updated = await updateBookmark(userId!, data.id, data.title);
      if (!updated) {
        return NextResponse.json({ error: "Failed to update bookmark or bookmark not found." }, { status: 404 });
      }
      return NextResponse.json({ success: true, bookmark: updated });
    } else {
      const updated = await updateHighlight(userId!, data.id, { color: data.color, note: data.note });
      if (!updated) {
        return NextResponse.json({ error: "Failed to update highlight or highlight not found." }, { status: 404 });
      }
      return NextResponse.json({ success: true, highlight: updated });
    }
  }
);

export const DELETE = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    querySchema: deleteAnnotationSchema,
  },
  async ({ userId, query }) => {
    const { id, type, bookId, pageNumber } = query as z.infer<typeof deleteAnnotationSchema>;

    if (type === "bookmark" && bookId && pageNumber) {
      const isOwner = await verifyBookOwnership(userId!, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }
      const pNum = typeof pageNumber === "string" ? parseInt(pageNumber, 10) : pageNumber;
      const success = await deleteBookmark(userId!, undefined, bookId, pNum);
      return NextResponse.json({ success });
    }

    if (!id) {
      return NextResponse.json({ error: "Annotation ID is required." }, { status: 400 });
    }

    if (type === "bookmark") {
      const success = await deleteBookmark(userId!, id);
      if (!success) {
        return NextResponse.json({ error: "Failed to delete bookmark or bookmark not found." }, { status: 404 });
      }
    } else {
      const success = await deleteHighlight(userId!, id);
      if (!success) {
        return NextResponse.json({ error: "Failed to delete highlight or highlight not found." }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true });
  }
);
