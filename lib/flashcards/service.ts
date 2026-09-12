import { createAdminClient } from "@/lib/supabase/admin";
import { Flashcard } from "@/types";

export async function getFlashcardsForBook(
  userId: string,
  bookId: string
): Promise<Flashcard[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];

  const { data: rows, error } = await supabase
    .from("flashcards")
    .select("*")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !rows) return [];

  return rows.map((r) => ({
    id: r.id,
    bookId: r.book_id || bookId,
    chapterId: r.chapter_id || "ch-1",
    pageNumber: r.page_number || r.source_page || 1,
    concept: r.concept || "General",
    question: r.question || r.front || "",
    answer: r.answer || r.back || "",
    status: (r.status as "unseen" | "learning" | "mastered") || "unseen",
    lastReviewed: r.last_reviewed || undefined,
  }));
}
