import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Book, BookPage, Chapter } from "@/types";

export async function getBooksForUser(userId: string): Promise<Book[]> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId) return [];

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
    coverImage: b.cover_image || undefined,
    subject: b.subject || "General Studies",
    chapters: [],
    pages: [],
    chunks: [],
  }));
}

export async function getBookForUser(userId: string, bookId: string): Promise<Book | null> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !bookId) return null;

  const { data: b, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", bookId)
    .eq("user_id", userId)
    .single();

  if (error || !b) return null;

  // Fetch chapters & pages concurrently
  const [{ data: pageRows }, { data: chapterRows }] = await Promise.all([
    supabase
      .from("book_pages")
      .select("*")
      .eq("book_id", bookId)
      .order("page_number", { ascending: true }),
    supabase
      .from("chapters")
      .select("*, sections(*)")
      .eq("book_id", bookId)
      .order("number", { ascending: true }),
  ]);

  const pages: BookPage[] = (pageRows || []).map((p) => ({
    pageNumber: p.page_number,
    chapterId: p.chapter_id || null,
    chapterTitle: p.chapter_title || null,
    sectionId: p.section_id || null,
    sectionTitle: p.section_title || null,
    title: p.title || `Page ${p.page_number}`,
    content: p.content || "",
    keyTakeaways: p.key_takeaways || [],
    equations: p.equations || [],
  }));

  const chapters: Chapter[] = (chapterRows || []).map((ch) => ({
    id: ch.id,
    number: ch.number,
    title: ch.title,
    startPage: ch.start_page,
    endPage: ch.end_page,
    sections: (ch.sections || []).map((sec: any) => ({
      id: sec.id,
      number: sec.number,
      title: sec.title,
      page: sec.page_number,
    })),
  }));

  return {
    id: b.id,
    title: b.title,
    author: b.author || "Unknown Author",
    edition: b.edition || "1st Edition",
    totalPages: b.total_pages || pages.length,
    coverImage: b.cover_image || undefined,
    subject: b.subject || "General Studies",
    chapters,
    pages,
    chunks: [],
  };
}

export async function getBookPage(
  userId: string,
  bookId: string,
  pageNumber: number
): Promise<BookPage | null> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !bookId) return null;

  const { data: p, error } = await supabase
    .from("book_pages")
    .select("*, books!inner(user_id)")
    .eq("book_id", bookId)
    .eq("page_number", pageNumber)
    .eq("books.user_id", userId)
    .single();

  if (error || !p) return null;

  return {
    pageNumber: p.page_number,
    chapterId: p.chapter_id || null,
    chapterTitle: p.chapter_title || null,
    sectionId: p.section_id || null,
    sectionTitle: p.section_title || null,
    title: p.title || `Page ${p.page_number}`,
    content: p.content || "",
    keyTakeaways: p.key_takeaways || [],
    equations: p.equations || [],
  };
}

export async function updateBookLastPage(
  userId: string,
  bookId: string,
  lastPageRead: number
): Promise<boolean> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !bookId) return false;

  const { error } = await supabase
    .from("books")
    .update({
      last_page_read: lastPageRead,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookId)
    .eq("user_id", userId);

  return !error;
}

export async function deleteBook(userId: string, bookId: string): Promise<boolean> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !bookId) return false;

  // 1. Get storage path
  const { data: book } = await supabase
    .from("books")
    .select("storage_path")
    .eq("id", bookId)
    .eq("user_id", userId)
    .single();

  if (book?.storage_path) {
    await supabase.storage.from("textbooks").remove([book.storage_path]);
  }

  // 2. Delete database record (cascades pages, chunks, highlights, bookmarks, quizzes)
  const { error } = await supabase
    .from("books")
    .delete()
    .eq("id", bookId)
    .eq("user_id", userId);

  return !error;
}
