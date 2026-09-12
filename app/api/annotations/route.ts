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
      return NextResponse.json({ success: true, highlights: [], notes: [] });
    }

    const supabase = await createServerSupabaseClient() || createAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: true, highlights: [], notes: [] });
    }

    const { data: highlights } = await supabase
      .from("highlights")
      .select("*")
      .eq("user_id", userId)
      .eq("book_id", bookId);

    return NextResponse.json({
      success: true,
      highlights: (highlights || []).map((h) => ({
        id: h.id,
        pageNumber: h.page_number,
        text: h.text,
        color: h.color || "yellow",
        note: h.note,
        createdAt: h.created_at,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: true, highlights: [] });
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
    const { bookId, pageNumber, text, color, note } = body;

    if (!bookId || !text) {
      return NextResponse.json({ error: "Missing required annotation fields." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient() || createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable." }, { status: 500 });
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
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to save annotation." }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
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

    if (!id) {
      return NextResponse.json({ error: "Annotation ID is required." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient() || createAdminClient();
    if (supabase) {
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
