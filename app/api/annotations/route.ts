import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get("bookId");
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId || !bookId) {
      return NextResponse.json({ success: true, highlights: [], bookmarks: [] });
    }

    if (!bookId.startsWith("demo-")) {
      const isOwner = await verifyBookOwnership(userId, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }
    }

    const supabase = (await createServerSupabaseClient()) || createAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: true, highlights: [], bookmarks: [] });
    }

    const [{ data: highlights }, { data: bookmarks }] = await Promise.all([
      supabase
        .from("highlights")
        .select("*")
        .eq("user_id", userId)
        .eq("book_id", bookId)
        .order("created_at", { ascending: false }),
      supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", userId)
        .eq("book_id", bookId)
        .order("page_number", { ascending: true }),
    ]);

    return NextResponse.json({
      success: true,
      highlights: (highlights || []).map((h) => ({
        id: h.id,
        pageNumber: h.page_number,
        text: h.text,
        color: h.color || "yellow",
        note: h.note,
        boundingRect: h.bounding_rect || undefined,
        rects: h.rects || undefined,
        createdAt: h.created_at,
      })),
      bookmarks: (bookmarks || []).map((b) => ({
        id: b.id,
        pageNumber: b.page_number,
        title: b.title,
        createdAt: b.created_at,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: true, highlights: [], bookmarks: [] });
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
    const { type, bookId, pageNumber, text, color, note, title, boundingRect, rects } = body;

    if (!bookId) {
      return NextResponse.json({ error: "Book ID is required." }, { status: 400 });
    }

    const supabase = (await createServerSupabaseClient()) || createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable." }, { status: 500 });
    }

    if (type === "bookmark") {
      const { data, error } = await supabase
        .from("bookmarks")
        .upsert(
          {
            user_id: userId,
            book_id: bookId,
            page_number: pageNumber || 1,
            title: title || `Page ${pageNumber || 1}`,
          },
          { onConflict: "user_id,book_id,page_number" }
        )
        .select("id")
        .single();

      if (error) {
        return NextResponse.json({ error: "Failed to save bookmark." }, { status: 500 });
      }

      return NextResponse.json({ success: true, id: data?.id, type: "bookmark" });
    }

    if (!text) {
      return NextResponse.json({ error: "Missing required highlight text." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("highlights")
      .insert({
        user_id: userId,
        book_id: bookId,
        page_number: pageNumber || 1,
        text: text.slice(0, 2000),
        color: color || "yellow",
        note: note ? note.slice(0, 2000) : null,
        bounding_rect: boundingRect || null,
        rects: rects || null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to save annotation." }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id, type: "highlight" });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to save annotation." }, { status: 500 });
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

    const supabase = (await createServerSupabaseClient()) || createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    if (type === "bookmark" && bookId && pageNumber) {
      await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", userId)
        .eq("book_id", bookId)
        .eq("page_number", parseInt(pageNumber, 10));
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: "Annotation ID is required." }, { status: 400 });
    }

    if (type === "bookmark") {
      await supabase
        .from("bookmarks")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
    } else {
      await supabase
        .from("highlights")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to delete annotation." }, { status: 500 });
  }
}
