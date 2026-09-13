import { createServerSupabaseClient } from "@/lib/supabase/server";
import { QuizQuestion, QuizAttempt, QuizAttemptAnswer } from "@/types";

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
  const supabase = await createServerSupabaseClient();
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
      chapterId: qq.chapter_id || null,
      pageNumber: qq.page_number,
      concept: qq.concept,
      question: qq.question,
      options: qq.options || [],
      explanation: qq.explanation,
      difficulty: qq.difficulty || "medium",
    })),
  }));
}

export async function getQuizById(
  userId: string,
  quizId: string
): Promise<SavedQuiz | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !quizId) return null;

  const { data: quiz, error } = await supabase
    .from("quizzes")
    .select("*, quiz_questions(*)")
    .eq("id", quizId)
    .eq("user_id", userId)
    .single();

  if (error || !quiz) return null;

  return {
    id: quiz.id,
    bookId: quiz.book_id,
    title: quiz.title,
    totalQuestions: quiz.total_questions || (quiz.quiz_questions || []).length,
    createdAt: quiz.created_at,
    questions: (quiz.quiz_questions || []).map((qq: any) => ({
      id: qq.id,
      bookId: qq.book_id,
      chapterId: qq.chapter_id || null,
      pageNumber: qq.page_number,
      concept: qq.concept,
      question: qq.question,
      options: qq.options || [],
      explanation: qq.explanation,
      difficulty: qq.difficulty || "medium",
    })),
  };
}

export async function saveQuizWithQuestions(
  userId: string,
  bookId: string,
  title: string,
  questions: QuizQuestion[]
): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !bookId || questions.length === 0) return null;

  // 1. Insert quiz record
  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .insert({
      user_id: userId,
      book_id: bookId,
      title: title || "Chapter Assessment",
      total_questions: questions.length,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (quizErr || !quiz) {
    console.error("Failed to insert quiz:", quizErr);
    return null;
  }

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
    created_at: new Date().toISOString(),
  }));

  const { error: questErr } = await supabase.from("quiz_questions").insert(questionRecords);
  if (questErr) {
    console.error("Failed to insert quiz questions:", questErr);
    // Rollback quiz parent record if question insertion fails
    await supabase.from("quizzes").delete().eq("id", quiz.id);
    return null;
  }

  return quiz.id;
}

export interface SubmitAttemptParams {
  quizId: string;
  bookId?: string;
  answers: { questionId: string; selectedOptionId: string }[];
  startedAt?: string;
  completedAt?: string;
  timeSpentSeconds?: number;
  concept?: string;
  chapterTitle?: string;
  pageNumber?: number;
}

export interface SubmitAttemptResult {
  attemptId: string;
  score: number;
  totalQuestions: number;
  answers: QuizAttemptAnswer[];
  startedAt: string;
  completedAt: string;
  timeSpent: number;
  conceptMastery?: {
    concept: string;
    masteryPercentage: number;
    isWeak: boolean;
  };
}

export async function submitQuizAttempt(
  userId: string,
  params: SubmitAttemptParams
): Promise<SubmitAttemptResult | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !params.quizId) return null;

  // 1. Retrieve the quiz and questions from database to verify ownership and correct answers
  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .select("*, quiz_questions(*)")
    .eq("id", params.quizId)
    .eq("user_id", userId)
    .single();

  if (quizErr || !quiz) {
    console.warn("Quiz not found or user does not own quiz:", params.quizId);
    return null;
  }

  const questions: any[] = quiz.quiz_questions || [];
  if (questions.length === 0) {
    console.warn("Quiz has no associated questions");
    return null;
  }

  // 2. Server-side score calculation - NEVER trust client-provided score
  let calculatedScore = 0;
  const evaluatedAnswers: QuizAttemptAnswer[] = [];

  const answersMap = new Map<string, string>();
  for (const ans of params.answers || []) {
    if (ans.questionId && ans.selectedOptionId) {
      answersMap.set(ans.questionId, ans.selectedOptionId);
    }
  }

  for (const q of questions) {
    const selectedOptId = answersMap.get(q.id);
    const options: any[] = Array.isArray(q.options) ? q.options : [];
    
    // Find matching correct option
    const correctOpt = options.find((o) => o.isCorrect === true);
    const isCorrect = Boolean(selectedOptId && correctOpt && correctOpt.id === selectedOptId);

    if (isCorrect) {
      calculatedScore++;
    }

    evaluatedAnswers.push({
      questionId: q.id,
      selectedOptionId: selectedOptId || "",
      isCorrect,
    });
  }

  // 3. Compute real time spent and timestamps
  if (!params.startedAt || !params.completedAt) {
    throw new Error("startedAt and completedAt timestamps are strictly required.");
  }
  
  const startedAt = params.startedAt;
  const completedAt = params.completedAt;
  
  const calculatedTimeSpent = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  
  const timeSpent = typeof params.timeSpentSeconds === "number" && params.timeSpentSeconds >= 0
    ? Math.round(params.timeSpentSeconds)
    : calculatedTimeSpent;

  // 4. Save attempt to quiz_attempts table
  const { data: attempt, error: attemptErr } = await supabase
    .from("quiz_attempts")
    .insert({
      user_id: userId,
      book_id: params.bookId || quiz.book_id || null,
      quiz_id: quiz.id,
      score: calculatedScore,
      total_questions: questions.length,
      answers: evaluatedAnswers,
      started_at: startedAt,
      completed_at: completedAt,
      time_spent: timeSpent,
    })
    .select("id")
    .single();

  if (attemptErr || !attempt) {
    console.error("Failed to insert quiz attempt:", attemptErr);
    return null;
  }

  // 5. Update Student Concept Mastery
  const primaryConcept = params.concept || questions[0]?.concept || "Core Concept";
  let masteryResult: { concept: string; masteryPercentage: number; isWeak: boolean } | undefined;

  if (primaryConcept) {
    // Find or create concept
    let conceptId: string | null = null;
    const { data: existingConcept } = await supabase
      .from("concepts")
      .select("id")
      .eq("name", primaryConcept)
      .single();

    if (existingConcept) {
      conceptId = existingConcept.id;
    } else {
      const { data: newConcept } = await supabase
        .from("concepts")
        .insert({
          name: primaryConcept,
          category: params.chapterTitle || "Academic Studies",
        })
        .select("id")
        .single();

      if (newConcept) {
        conceptId = newConcept.id;
      }
    }

    if (conceptId) {
      const { data: existingStudentConcept } = await supabase
        .from("student_concepts")
        .select("*")
        .eq("user_id", userId)
        .eq("concept_id", conceptId)
        .single();

      const prevAttempted = existingStudentConcept?.questions_attempted || 0;
      const prevCorrect = existingStudentConcept?.questions_correct || 0;

      const updatedAttempted = prevAttempted + questions.length;
      const updatedCorrect = prevCorrect + calculatedScore;
      const calculatedMastery = updatedAttempted > 0
        ? Math.min(100, Math.max(0, Math.round((updatedCorrect / updatedAttempted) * 100)))
        : 0;

      const isWeak = calculatedMastery < 60;

      await supabase.from("student_concepts").upsert(
        {
          user_id: userId,
          concept_id: conceptId,
          mastery_percentage: calculatedMastery,
          questions_attempted: updatedAttempted,
          questions_correct: updatedCorrect,
          is_weak: isWeak,
          recommended_chapter: params.chapterTitle || `Chapter Review`,
          recommended_page: params.pageNumber || questions[0]?.page_number || 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,concept_id" }
      );

      masteryResult = {
        concept: primaryConcept,
        masteryPercentage: calculatedMastery,
        isWeak,
      };
    }
  }

  return {
    attemptId: attempt.id,
    score: calculatedScore,
    totalQuestions: questions.length,
    answers: evaluatedAnswers,
    startedAt,
    completedAt,
    timeSpent,
    conceptMastery: masteryResult,
  };
}

