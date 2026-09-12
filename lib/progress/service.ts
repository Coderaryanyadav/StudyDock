import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudentProgress, StudyPlanItem } from "@/types";

export async function recordStudyEvent(
  userId: string,
  durationMinutes: number,
  pagesRead: number = 1,
  bookId?: string
): Promise<boolean> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId) return false;

  const { error } = await supabase.from("study_sessions").insert({
    user_id: userId,
    book_id: bookId || null,
    duration_minutes: durationMinutes,
    pages_read: pagesRead,
  });

  return !error;
}

export async function getDashboardData(userId: string): Promise<StudentProgress> {
  return getProgressForUser(userId);
}

export async function getProgressForUser(userId: string): Promise<StudentProgress> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  const defaultProgress: StudentProgress = {
    totalStudyMinutes: 0,
    streakDays: 0,
    chaptersCompleted: 0,
    videosWatched: 0,
    quizzesCompleted: 0,
    questionsAsked: 0,
    activeSubject: "Computer Science",
    concepts: [],
    todayPlan: [],
  };

  if (!supabase || !userId) return defaultProgress;

  try {
    // 1. Study sessions for minutes and streak
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("created_at, duration_minutes, pages_read")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    let streakDays = 0;
    let totalStudyMinutes = 0;
    let totalPagesRead = 0;

    if (sessions && sessions.length > 0) {
      totalStudyMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
      totalPagesRead = sessions.reduce((acc, s) => acc + (s.pages_read || 0), 0);

      const uniqueDays = Array.from(
        new Set(
          sessions
            .filter((s) => s.created_at)
            .map((s) => new Date(s.created_at).toISOString().split("T")[0])
        )
      ).sort().reverse();

      if (uniqueDays.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

        let currentDate: string | null = (uniqueDays[0] === today || uniqueDays[0] === yesterday) ? uniqueDays[0] : null;
        if (currentDate) {
          streakDays = 1;
          for (let i = 1; i < uniqueDays.length; i++) {
            const prevExpected = new Date(new Date(currentDate).getTime() - 86400000).toISOString().split("T")[0];
            if (uniqueDays[i] === prevExpected) {
              streakDays++;
              currentDate = uniqueDays[i];
            } else {
              break;
            }
          }
        }
      }
    }

    // 2. Questions count from user messages joined via conversations
    const { data: userConvos } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", userId);

    let questionsAsked = 0;
    const convoIds = (userConvos || []).map((c) => c.id);
    if (convoIds.length > 0) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convoIds)
        .eq("sender", "user");
      questionsAsked = count || 0;
    }

    // 3. Concepts from student_concepts joined to concepts table
    const { data: conceptsData } = await supabase
      .from("student_concepts")
      .select("*, concepts(name, category)")
      .eq("user_id", userId);

    // 4. Quiz count from quiz_attempts
    const { count: quizCount } = await supabase
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    // 5. Videos count
    const { count: videoCount } = await supabase
      .from("videos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    // 6. Active Book for subject & reading plan
    const { data: latestBook } = await supabase
      .from("books")
      .select("id, title, subject, last_page_read, total_pages")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    const concepts = (conceptsData || []).map((c: any) => ({
      id: c.id,
      name: c.concepts?.name || c.name || "Academic Concept",
      category: c.concepts?.category || c.category || "General Studies",
      masteryPercentage: c.mastery_percentage ?? 50,
      questionsAttempted: c.questions_attempted || 0,
      questionsCorrect: c.questions_correct || 0,
      isWeak: Boolean(c.is_weak || (c.mastery_percentage ?? 50) < 60),
      recommendedChapter: c.recommended_chapter || "Chapter 1",
      recommendedPage: c.recommended_page || 1,
    }));

    // Dynamic Study Plan based on current book and weak concepts
    const todayPlan: StudyPlanItem[] = [];
    if (latestBook) {
      todayPlan.push({
        id: "plan-reading",
        title: `Read ${latestBook.title}`,
        type: "reading",
        target: `Pages ${latestBook.last_page_read || 1}–${Math.min((latestBook.last_page_read || 1) + 10, latestBook.total_pages || 100)}`,
        completed: false,
        estimatedMinutes: 25,
      });
    }

    const weakConcept = concepts.find((c) => c.isWeak || c.masteryPercentage < 60);
    if (weakConcept) {
      todayPlan.push({
        id: "plan-weak-review",
        title: `Review Weak Concept: ${weakConcept.name}`,
        type: "quiz",
        target: `${weakConcept.recommendedChapter} (p.${weakConcept.recommendedPage})`,
        completed: false,
        estimatedMinutes: 15,
      });
    }

    todayPlan.push({
      id: "plan-flashcards",
      title: "Daily Flashcard Retention Practice",
      type: "flashcards",
      target: "High-yield active recall deck",
      completed: false,
      estimatedMinutes: 10,
    });

    return {
      totalStudyMinutes,
      streakDays,
      chaptersCompleted: Math.floor(totalPagesRead / 25),
      videosWatched: videoCount || 0,
      quizzesCompleted: quizCount || 0,
      questionsAsked: questionsAsked || 0,
      activeSubject: latestBook?.subject || "Computer Science",
      concepts,
      todayPlan,
    };
  } catch (err) {
    console.error("Progress calculation error:", err);
    return defaultProgress;
  }
}
