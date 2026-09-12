import { createAdminClient } from "@/lib/supabase/admin";
import { QuizQuestion } from "@/types";

export async function getQuizzesForBook(
  userId: string,
  bookId: string
): Promise<{ id: string; title: string; questions: QuizQuestion[] }[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];

  const { data: rows, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !rows) return [];

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    questions: r.questions as QuizQuestion[],
  }));
}
