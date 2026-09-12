import { createAdminClient } from "@/lib/supabase/admin";
import { Book, BookPage } from "@/types";

export async function getBooksForUser(userId: string): Promise<Book[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];

  const { data: books, error } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !books) return [];

  return books.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author || "Unknown Author",
    edition: b.edition || "1st Edition",
    totalPages: b.total_pages || 0,
    coverImage: b.cover_url || undefined,
    subject: b.subject || "General",
    chapters: b.chapters || [],
    pages: [],
    chunks: [],
  }));
}

export async function getBookForUser(userId: string, bookId: string): Promise<Book | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data: b, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", bookId)
    .eq("user_id", userId)
    .single();

  if (error || !b) return null;

  const { data: pageRows } = await supabase
    .from("book_pages")
    .select("*")
    .eq("book_id", bookId)
    .order("page_number", { ascending: true });

  const pages: BookPage[] = (pageRows || []).map((p) => ({
    pageNumber: p.page_number,
    chapterId: p.chapter_id || null,
    chapterTitle: p.chapter_title || null,
    sectionId: p.section_id || null,
    sectionTitle: p.section_title || null,
    title: p.chapter_title || `Page ${p.page_number}`,
    content: p.content || "",
    keyTakeaways: p.key_concepts || [],
  }));

  return {
    id: b.id,
    title: b.title,
    author: b.author || "Unknown Author",
    edition: b.edition || "1st Edition",
    totalPages: b.total_pages || pages.length,
    coverImage: b.cover_url || undefined,
    subject: b.subject || "General",
    chapters: b.chapters || [],
    pages,
    chunks: [],
  };
}

export async function getBookPage(
  userId: string,
  bookId: string,
  pageNumber: number
): Promise<BookPage | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  // Verify ownership
  const { data: book } = await supabase
    .from("books")
    .select("id")
    .eq("id", bookId)
    .eq("user_id", userId)
    .single();

  if (!book) return null;

  const { data: p, error } = await supabase
    .from("book_pages")
    .select("*")
    .eq("book_id", bookId)
    .eq("page_number", pageNumber)
    .single();

  if (error || !p) return null;

  return {
    pageNumber: p.page_number,
    chapterId: p.chapter_id || null,
    chapterTitle: p.chapter_title || null,
    sectionId: p.section_id || null,
    sectionTitle: p.section_title || null,
    title: p.chapter_title || `Page ${p.page_number}`,
    content: p.content || "",
    keyTakeaways: p.key_concepts || [],
  };
}
