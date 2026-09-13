import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Bookmark, Highlight, HighlightRect } from "@/types";

export function sanitizeText(str: unknown, maxLen = 4000): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/\0/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .trim()
    .slice(0, maxLen);
}

export function validateNormalizedRect(rect: HighlightRect): boolean {
  if (typeof rect !== "object" || rect === null) return false;
  const { x, y, width, height } = rect;
  return (
    typeof x === "number" &&
    typeof y === "number" &&
    typeof width === "number" &&
    typeof height === "number" &&
    !isNaN(x) &&
    !isNaN(y) &&
    !isNaN(width) &&
    !isNaN(height) &&
    isFinite(x) &&
    isFinite(y) &&
    isFinite(width) &&
    isFinite(height) &&
    x >= 0 &&
    x <= 1 &&
    y >= 0 &&
    y <= 1 &&
    width > 0 &&
    width <= 1 &&
    height > 0 &&
    height <= 1
  );
}

export function clampNormalizedRect(rect: HighlightRect): HighlightRect | null {
  if (!validateNormalizedRect(rect)) return null;
  return {
    x: Math.max(0, Math.min(1, Math.round(rect.x * 10000) / 10000)),
    y: Math.max(0, Math.min(1, Math.round(rect.y * 10000) / 10000)),
    width: Math.max(0.0001, Math.min(1 - rect.x, Math.round(rect.width * 10000) / 10000)),
    height: Math.max(0.0001, Math.min(1 - rect.y, Math.round(rect.height * 10000) / 10000)),
  };
}

export async function getHighlightsForBook(
  userId: string,
  bookId: string
): Promise<Highlight[]> {
  const supabase = await createServerSupabaseClient();
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
    color: (h.color as "yellow" | "blue" | "green" | "pink") || "yellow",
    note: h.note || undefined,
    boundingRect: h.bounding_rect || undefined,
    rects: h.rects || undefined,
    createdAt: h.created_at,
    updatedAt: h.updated_at || h.created_at,
  }));
}

export async function getBookmarksForBook(
  userId: string,
  bookId: string
): Promise<Bookmark[]> {
  const supabase = await createServerSupabaseClient();
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
    updatedAt: b.updated_at || b.created_at,
  }));
}

export async function saveHighlight(
  userId: string,
  data: {
    bookId: string;
    pageNumber: number;
    text: string;
    color?: Highlight["color"];
    note?: string;
    boundingRect?: HighlightRect | null;
    rects?: HighlightRect[];
  }
): Promise<Highlight | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !data.bookId || !data.text) return null;

  const validColors: Highlight["color"][] = ["yellow", "blue", "green", "pink", "rose", "purple", "orange"];
  const color = data.color && validColors.includes(data.color) ? data.color : "yellow";
  const sanitizedText = sanitizeText(data.text, 4000);
  if (!sanitizedText) return null;

  // Validate and clamp normalized bounding boxes if provided
  let validBoundingRect: HighlightRect | null = null;
  if (data.boundingRect) {
    validBoundingRect = clampNormalizedRect(data.boundingRect);
  }

  let validRects: HighlightRect[] = [];
  if (Array.isArray(data.rects)) {
    validRects = data.rects
      .map(clampNormalizedRect)
      .filter((r): r is HighlightRect => r !== null);
  }

  const { data: row, error } = await supabase
    .from("highlights")
    .insert({
      user_id: userId,
      book_id: data.bookId,
      page_number: Math.max(1, Math.floor(data.pageNumber || 1)),
      text: sanitizedText,
      color,
      note: data.note ? sanitizeText(data.note, 2000) : null,
      bounding_rect: validBoundingRect,
      rects: validRects.length > 0 ? validRects : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
    updatedAt: row.updated_at,
  };
}

export async function updateHighlight(
  userId: string,
  highlightId: string,
  updates: {
    color?: Highlight["color"];
    note?: string;
  }
): Promise<Highlight | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !highlightId) return null;

  const validColors: Highlight["color"][] = ["yellow", "blue", "green", "pink", "rose", "purple", "orange"];
  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.color && validColors.includes(updates.color)) {
    patch.color = updates.color;
  }
  if (updates.note !== undefined) {
    patch.note = updates.note ? updates.note.slice(0, 2000) : null;
  }

  const { data: row, error } = await supabase
    .from("highlights")
    .update(patch)
    .eq("id", highlightId)
    .eq("user_id", userId)
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
    updatedAt: row.updated_at,
  };
}

export async function deleteHighlight(
  userId: string,
  highlightId: string
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
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
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !data.bookId) return null;

  const pageNum = Math.max(1, Math.floor(data.pageNumber || 1));
  const title = (data.title || `Page ${pageNum}`).slice(0, 200);

  const { data: row, error } = await supabase
    .from("bookmarks")
    .upsert(
      {
        user_id: userId,
        book_id: data.bookId,
        page_number: pageNum,
        title,
        updated_at: new Date().toISOString(),
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
    updatedAt: row.updated_at,
  };
}

export async function updateBookmark(
  userId: string,
  bookmarkId: string,
  title: string
): Promise<Bookmark | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !bookmarkId || !title) return null;

  const { data: row, error } = await supabase
    .from("bookmarks")
    .update({
      title: title.slice(0, 200),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookmarkId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !row) return null;

  return {
    id: row.id,
    bookId: row.book_id,
    pageNumber: row.page_number,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function deleteBookmark(
  userId: string,
  bookmarkId?: string,
  bookId?: string,
  pageNumber?: number
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
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
