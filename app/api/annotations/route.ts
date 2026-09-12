import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
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
      return NextResponse.json({ error: "Access denied. You do not own this book." }, { status: 403 });
    }

    const [highlights, bookmarks] = await Promise.all([
      getHighlightsForBook(userId, bookId),
      getBookmarksForBook(userId, bookId),
    ]);

    return NextResponse.json({
      success: true,
      highlights,
      bookmarks,
    });
  } catch (error: any) {
    console.error("Annotations GET error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch annotations." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required to save annotations." }, { status: 401 });
    }

    const body = await req.json();
    const type = body.type;
    const bookId = body.bookId;
    const pageNumber = body.pageNumber;
    const text = body.text || body.selectedText;
    const color = body.color;
    const note = body.note;
    const title = body.title;
    const boundingRect = body.boundingRect || body.positionData?.boundingRect;
    const rects = body.rects || body.positionData?.rects;

    if (!bookId) {
      return NextResponse.json({ error: "Book ID is required." }, { status: 400 });
    }

    const isOwner = await verifyBookOwnership(userId, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied. You do not own this textbook." }, { status: 403 });
    }

    if (type === "bookmark") {
      const bookmark = await saveBookmark(userId, {
        bookId,
        pageNumber: pageNumber || 1,
        title,
      });

      if (!bookmark) {
        return NextResponse.json({ error: "Failed to save bookmark." }, { status: 500 });
      }

      // Log tracking event
      await recordStudyEvent(userId, {
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

    const highlight = await saveHighlight(userId, {
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

    // Log tracking event
    await recordStudyEvent(userId, {
      bookId,
      eventType: "highlight_created",
      pageNumber: pageNumber || 1,
      metadata: { highlightId: highlight.id, color },
    }).catch(() => {});

    return NextResponse.json({ success: true, id: highlight.id, type: "highlight", highlight });
  } catch (error: any) {
    console.error("Annotations POST error:", error?.message || error);
    return NextResponse.json({ error: "Failed to save annotation." }, { status: 500 });
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
    const { id, type, color, note, title } = body;

    if (!id) {
      return NextResponse.json({ error: "Annotation ID is required." }, { status: 400 });
    }

    if (type === "bookmark") {
      if (!title) {
        return NextResponse.json({ error: "Title is required to update bookmark." }, { status: 400 });
      }
      const updated = await updateBookmark(userId, id, title);
      if (!updated) {
        return NextResponse.json({ error: "Failed to update bookmark or bookmark not found." }, { status: 404 });
      }
      return NextResponse.json({ success: true, bookmark: updated });
    } else {
      const updated = await updateHighlight(userId, id, { color, note });
      if (!updated) {
        return NextResponse.json({ error: "Failed to update highlight or highlight not found." }, { status: 404 });
      }
      return NextResponse.json({ success: true, highlight: updated });
    }
  } catch (error: any) {
    console.error("Annotations PATCH error:", error?.message || error);
    return NextResponse.json({ error: "Failed to update annotation." }, { status: 500 });
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
    const type = searchParams.get("type");
    const bookId = searchParams.get("bookId");
    const pageNumber = searchParams.get("pageNumber");

    if (type === "bookmark" && bookId && pageNumber) {
      const isOwner = await verifyBookOwnership(userId, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }

      const success = await deleteBookmark(userId, undefined, bookId, parseInt(pageNumber, 10));
      return NextResponse.json({ success });
    }

    if (!id) {
      return NextResponse.json({ error: "Annotation ID is required." }, { status: 400 });
    }

    if (type === "bookmark") {
      const success = await deleteBookmark(userId, id);
      if (!success) {
        return NextResponse.json({ error: "Failed to delete bookmark or bookmark not found." }, { status: 404 });
      }
    } else {
      const success = await deleteHighlight(userId, id);
      if (!success) {
        return NextResponse.json({ error: "Failed to delete highlight or highlight not found." }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Annotations DELETE error:", error?.message || error);
    return NextResponse.json({ error: "Failed to delete annotation." }, { status: 500 });
  }
}
