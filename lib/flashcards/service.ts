import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Flashcard } from "@/types";

export async function getFlashcardsForBook(
  userId: string,
  bookId: string
): Promise<Flashcard[]> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !bookId) return [];

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
    chapterId: `ch-${r.page_number}`,
    pageNumber: r.page_number || 1,
    concept: r.concept || "General",
    question: r.question,
    answer: r.answer,
    status: (r.status as "unseen" | "learning" | "mastered") || "unseen",
    lastReviewed: r.last_reviewed || undefined,
  }));
}

export async function saveFlashcards(
  userId: string,
  bookId: string,
  cards: Partial<Flashcard>[]
): Promise<Flashcard[]> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !bookId || cards.length === 0) return [];

  const records = cards.map((c) => ({
    user_id: userId,
    book_id: bookId,
    page_number: c.pageNumber || 1,
    concept: c.concept || "General",
    question: c.question || "",
    answer: c.answer || "",
    status: c.status || "unseen",
  }));

  const { data: inserted, error } = await supabase
    .from("flashcards")
    .insert(records)
    .select("*");

  if (error || !inserted) return [];

  return inserted.map((r) => ({
    id: r.id,
    bookId: r.book_id,
    chapterId: `ch-${r.page_number}`,
    pageNumber: r.page_number,
    concept: r.concept,
    question: r.question,
    answer: r.answer,
    status: r.status,
    lastReviewed: r.last_reviewed,
  }));
}

export async function saveFlashcardReview(
  userId: string,
  flashcardId: string,
  status: "learning" | "mastered"
): Promise<boolean> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !flashcardId) return false;

  const { error } = await supabase
    .from("flashcards")
    .update({
      status,
      last_reviewed: new Date().toISOString(),
    })
    .eq("id", flashcardId)
    .eq("user_id", userId);

  return !error;
}
