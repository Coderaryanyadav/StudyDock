import { createAdminClient } from "@/lib/supabase/admin";
import { StudentProgress } from "@/types";

export async function getProgressForUser(userId: string): Promise<StudentProgress> {
  const supabase = createAdminClient();
  const defaultProgress: StudentProgress = {
    totalStudyMinutes: 0,
    streakDays: 0,
    chaptersCompleted: 0,
    videosWatched: 0,
    quizzesCompleted: 0,
    questionsAsked: 0,
    activeSubject: "General",
    concepts: [],
    todayPlan: [],
  };

  if (!supabase) return defaultProgress;

  try {
    // 1. Study sessions
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("created_at, duration_minutes")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    let streakDays = 0;
    let totalStudyMinutes = 0;

    if (sessions && sessions.length > 0) {
      totalStudyMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

      const uniqueDays = new Set(
        sessions.map((s) => new Date(s.created_at).toISOString().split("T")[0])
      );

      const today = new Date();
      const checkDate = new Date(today);
      let dayStr = checkDate.toISOString().split("T")[0];

      if (!uniqueDays.has(dayStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
        dayStr = checkDate.toISOString().split("T")[0];
      }

      while (uniqueDays.has(dayStr)) {
        streakDays++;
        checkDate.setDate(checkDate.getDate() - 1);
        dayStr = checkDate.toISOString().split("T")[0];
      }
    }

    // 2. Questions count
    const { count: questionsAsked } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user");

    // 3. Mastered concepts
    const { data: concepts } = await supabase
      .from("student_concepts")
      .select("*")
      .eq("user_id", userId);

    // 4. Quiz count
    const { data: quizzes } = await supabase
      .from("quiz_attempts")
      .select("score, total_questions")
      .eq("user_id", userId);

    const quizzesCompleted = quizzes?.length || 0;

    return {
      totalStudyMinutes,
      streakDays,
      chaptersCompleted: 0,
      videosWatched: 0,
      quizzesCompleted,
      questionsAsked: questionsAsked || 0,
      activeSubject: "Computer Science",
      concepts: (concepts || []).map((c) => ({
        id: c.id,
        name: c.concept_name,
        category: c.category || "General",
        masteryPercentage: c.mastery_level || 0,
        questionsAttempted: c.questions_attempted || 0,
        questionsCorrect: c.questions_correct || 0,
        isWeak: (c.mastery_level || 0) < 60,
        recommendedChapter: c.recommended_chapter || "Chapter 1",
        recommendedPage: c.recommended_page || 1,
      })),
      todayPlan: [],
    };
  } catch {
    return defaultProgress;
  }
}
