import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Flashcard } from "@/types";

export async function getFlashcardsForBook(
  userId: string,
  bookId: string
): Promise<Flashcard[]> {
  const supabase = await createServerSupabaseClient();
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
    chapterId: r.chapter_id || null,
    pageNumber: r.page_number || 1,
    concept: r.concept || "General",
    question: r.question,
    answer: r.answer,
    status: (r.status as "unseen" | "learning" | "mastered") || "unseen",
    lastReviewed: r.last_reviewed || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at || r.created_at,
  }));
}

export async function saveFlashcards(
  userId: string,
  bookId: string,
  cards: Partial<Flashcard>[]
): Promise<Flashcard[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !bookId || cards.length === 0) return [];

  const now = new Date().toISOString();
  const records = cards.map((c) => ({
    user_id: userId,
    book_id: bookId,
    page_number: Math.max(1, Math.floor(c.pageNumber || 1)),
    concept: (c.concept || "General").slice(0, 100),
    question: (c.question || "").slice(0, 2000),
    answer: (c.answer || "").slice(0, 4000),
    status: (c.status as "unseen" | "learning" | "mastered") || "unseen",
    created_at: now,
    updated_at: now,
  }));

  const { data: inserted, error } = await supabase
    .from("flashcards")
    .insert(records)
    .select("*");

  if (error || !inserted || inserted.length === 0) {
    console.error("Failed to insert flashcards:", error);
    return [];
  }

  return inserted.map((r) => ({
    id: r.id,
    bookId: r.book_id,
    chapterId: r.chapter_id || null,
    pageNumber: r.page_number,
    concept: r.concept,
    question: r.question,
    answer: r.answer,
    status: r.status,
    lastReviewed: r.last_reviewed || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function saveFlashcardReview(
  userId: string,
  flashcardId: string,
  status: "learning" | "mastered"
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !flashcardId) return false;

  const validStatuses = ["learning", "mastered"];
  if (!validStatuses.includes(status)) return false;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("flashcards")
    .update({
      status,
      last_reviewed: now,
      updated_at: now,
    })
    .eq("id", flashcardId)
    .eq("user_id", userId);

  return !error;
}

export async function deleteFlashcard(
  userId: string,
  flashcardId: string
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !flashcardId) return false;

  const { error } = await supabase
    .from("flashcards")
    .delete()
    .eq("id", flashcardId)
    .eq("user_id", userId);

  return !error;
}

