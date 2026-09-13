import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Note } from "@/types";

export async function getNotesForBook(
  userId: string,
  bookId: string
): Promise<Note[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !bookId) return [];

  const { data: rows, error } = await supabase
    .from("notes")
    .select("*")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !rows) return [];

  return rows.map((r) => ({
    id: r.id,
    bookId: r.book_id,
    pageNumber: r.page_number,
    selectedText: r.selected_text || undefined,
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function sanitizeNoteText(str: unknown, maxLen = 4000): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/\0/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .trim()
    .slice(0, maxLen);
}

export async function saveNote(
  userId: string,
  data: {
    bookId: string;
    pageNumber: number;
    selectedText?: string;
    content: string;
  }
): Promise<Note | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !data.bookId || !data.content) return null;

  const sanitizedContent = sanitizeNoteText(data.content, 4000);
  if (!sanitizedContent) return null;

  const { data: row, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      book_id: data.bookId,
      page_number: Math.max(1, Math.floor(data.pageNumber || 1)),
      selected_text: data.selectedText ? sanitizeNoteText(data.selectedText, 2000) : null,
      content: sanitizedContent,
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
    selectedText: row.selected_text || undefined,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateNote(
  userId: string,
  noteId: string,
  content: string
): Promise<Note | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !noteId || !content) return null;

  const sanitizedContent = sanitizeNoteText(content, 4000);
  if (!sanitizedContent) return null;

  const { data: row, error } = await supabase
    .from("notes")
    .update({
      content: sanitizedContent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !row) return null;

  return {
    id: row.id,
    bookId: row.book_id,
    pageNumber: row.page_number,
    selectedText: row.selected_text || undefined,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function deleteNote(
  userId: string,
  noteId: string
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !noteId) return false;

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", userId);

  return !error;
}
