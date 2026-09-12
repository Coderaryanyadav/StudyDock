import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { QuizQuestion } from "@/types";

export interface SavedQuiz {
  id: string;
  bookId: string;
  title: string;
  totalQuestions: number;
  createdAt: string;
  questions: QuizQuestion[];
}

export async function getQuizzesForBook(
  userId: string,
  bookId: string
): Promise<SavedQuiz[]> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !bookId) return [];

  const { data: quizzes, error: qErr } = await supabase
    .from("quizzes")
    .select("*, quiz_questions(*)")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (qErr || !quizzes) return [];

  return quizzes.map((q: any) => ({
    id: q.id,
    bookId: q.book_id,
    title: q.title,
    totalQuestions: q.total_questions || (q.quiz_questions || []).length,
    createdAt: q.created_at,
    questions: (q.quiz_questions || []).map((qq: any) => ({
      id: qq.id,
      bookId: qq.book_id,
      chapterId: `ch-${qq.page_number}`,
      pageNumber: qq.page_number,
      concept: qq.concept,
      question: qq.question,
      options: qq.options || [],
      explanation: qq.explanation,
      difficulty: qq.difficulty || "medium",
    })),
  }));
}

export async function saveQuizWithQuestions(
  userId: string,
  bookId: string,
  title: string,
  questions: QuizQuestion[]
): Promise<string | null> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !bookId || questions.length === 0) return null;

  // 1. Insert quiz record
  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .insert({
      user_id: userId,
      book_id: bookId,
      title: title || "Chapter Assessment",
      total_questions: questions.length,
    })
    .select("id")
    .single();

  if (quizErr || !quiz) return null;

  // 2. Insert questions
  const questionRecords = questions.map((q) => ({
    quiz_id: quiz.id,
    book_id: bookId,
    page_number: q.pageNumber || 1,
    concept: q.concept || "General",
    question: q.question,
    options: q.options,
    explanation: q.explanation || "",
    difficulty: q.difficulty || "medium",
  }));

  const { error: questErr } = await supabase.from("quiz_questions").insert(questionRecords);
  if (questErr) {
    console.error("Failed to insert quiz questions:", questErr);
    return null;
  }

  return quiz.id;
}

export async function saveQuizAttempt(
  userId: string,
  quizId: string,
  score: number,
  totalQuestions: number
): Promise<boolean> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !quizId) return false;

  const { error } = await supabase.from("quiz_attempts").insert({
    user_id: userId,
    quiz_id: quizId,
    score,
    total_questions: totalQuestions,
  });

  return !error;
}
