import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Bookmark, Highlight } from "@/types";

export async function getHighlightsForBook(
  userId: string,
  bookId: string
): Promise<Highlight[]> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !bookId) return [];

  const { data: rows, error } = await supabase
    .from("highlights")
    .select("*")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !rows) return [];

  return rows.map((h) => ({
    id: h.id,
    bookId: h.book_id,
    pageNumber: h.page_number,
    text: h.text,
    color: h.color || "yellow",
    note: h.note || undefined,
    boundingRect: h.bounding_rect || undefined,
    rects: h.rects || undefined,
    createdAt: h.created_at,
  }));
}

export async function getBookmarksForBook(
  userId: string,
  bookId: string
): Promise<Bookmark[]> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !bookId) return [];

  const { data: rows, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .order("page_number", { ascending: true });

  if (error || !rows) return [];

  return rows.map((b) => ({
    id: b.id,
    bookId: b.book_id,
    pageNumber: b.page_number,
    title: b.title,
    createdAt: b.created_at,
  }));
}

export async function saveHighlight(
  userId: string,
  data: {
    bookId: string;
    pageNumber: number;
    text: string;
    color?: string;
    note?: string;
    boundingRect?: any;
    rects?: any[];
  }
): Promise<Highlight | null> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !data.bookId || !data.text) return null;

  const { data: row, error } = await supabase
    .from("highlights")
    .insert({
      user_id: userId,
      book_id: data.bookId,
      page_number: data.pageNumber || 1,
      text: data.text.slice(0, 2000),
      color: data.color || "yellow",
      note: data.note ? data.note.slice(0, 2000) : null,
      bounding_rect: data.boundingRect || null,
      rects: data.rects || null,
    })
    .select("*")
    .single();

  if (error || !row) return null;

  return {
    id: row.id,
    bookId: row.book_id,
    pageNumber: row.page_number,
    text: row.text,
    color: row.color,
    note: row.note,
    boundingRect: row.bounding_rect,
    rects: row.rects,
    createdAt: row.created_at,
  };
}

export async function deleteHighlight(
  userId: string,
  highlightId: string
): Promise<boolean> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !highlightId) return false;

  const { error } = await supabase
    .from("highlights")
    .delete()
    .eq("id", highlightId)
    .eq("user_id", userId);

  return !error;
}

export async function saveBookmark(
  userId: string,
  data: {
    bookId: string;
    pageNumber: number;
    title?: string;
  }
): Promise<Bookmark | null> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !data.bookId) return null;

  const { data: row, error } = await supabase
    .from("bookmarks")
    .upsert(
      {
        user_id: userId,
        book_id: data.bookId,
        page_number: data.pageNumber || 1,
        title: data.title || `Page ${data.pageNumber || 1}`,
      },
      { onConflict: "user_id,book_id,page_number" }
    )
    .select("*")
    .single();

  if (error || !row) return null;

  return {
    id: row.id,
    bookId: row.book_id,
    pageNumber: row.page_number,
    title: row.title,
    createdAt: row.created_at,
  };
}

export async function deleteBookmark(
  userId: string,
  bookmarkId?: string,
  bookId?: string,
  pageNumber?: number
): Promise<boolean> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId) return false;

  let query = supabase.from("bookmarks").delete().eq("user_id", userId);

  if (bookmarkId) {
    query = query.eq("id", bookmarkId);
  } else if (bookId && pageNumber) {
    query = query.eq("book_id", bookId).eq("page_number", pageNumber);
  } else {
    return false;
  }

  const { error } = await query;
  return !error;
}
