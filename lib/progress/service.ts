import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StudentProgress, StudyPlanItem, StudyEvent, StudySession, StudyEventType } from "@/types";

// Maximum duration permitted per single event/heartbeat to prevent manufactured unlimited study time
const MAX_EVENT_DURATION_SECONDS = 300; // 5 minutes max per single event
const MAX_HEARTBEAT_SECONDS = 60; // 60 seconds max per heartbeat interval

/**
 * Record a real, validated study tracking event with server timestamps
 */
export async function recordStudyEvent(
  userId: string,
  event: {
    bookId?: string | null;
    sessionId?: string | null;
    eventType: StudyEventType;
    pageNumber?: number | null;
    durationSeconds?: number;
    metadata?: Record<string, any>;
  }
): Promise<StudyEvent | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId) return null;

  // Clamp duration to prevent manufactured unlimited study time
  const clampedDuration = Math.min(
    Math.max(0, Math.round(event.durationSeconds || 0)),
    MAX_EVENT_DURATION_SECONDS
  );

  const payload = {
    user_id: userId,
    book_id: event.bookId || null,
    session_id: event.sessionId || null,
    event_type: event.eventType,
    page_number: event.pageNumber ? Number(event.pageNumber) : null,
    duration_seconds: clampedDuration,
    metadata: event.metadata || {},
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("study_events")
    .insert(payload)
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to record study event:", error?.message || error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    bookId: data.book_id,
    sessionId: data.session_id,
    eventType: data.event_type as StudyEventType,
    pageNumber: data.page_number,
    durationSeconds: data.duration_seconds,
    metadata: data.metadata,
    createdAt: data.created_at,
  };
}

/**
 * Start a genuine study session
 */
export async function startStudySession(
  userId: string,
  bookId?: string | null,
  activityType: string = "reading"
): Promise<StudySession | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId) return null;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("study_sessions")
    .insert({
      user_id: userId,
      book_id: bookId || null,
      started_at: now,
      activity_type: activityType,
      duration_seconds: 0,
      duration_minutes: 0,
      pages_read: 0,
      pages_viewed: [],
      pages_completed: [],
      video_time_seconds: 0,
      questions_asked: 0,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to start study session:", error?.message || error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    bookId: data.book_id,
    startedAt: data.started_at,
    endedAt: data.ended_at,
    durationSeconds: data.duration_seconds || 0,
    durationMinutes: data.duration_minutes || 0,
    pagesRead: data.pages_read || 0,
    pagesViewed: data.pages_viewed || [],
    pagesCompleted: data.pages_completed || [],
    videoTimeSeconds: data.video_time_seconds || 0,
    questionsAsked: data.questions_asked || 0,
    activityType: data.activity_type || "reading",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update an ongoing study session with heartbeat duration and viewed pages
 */
export async function heartbeatStudySession(
  userId: string,
  sessionId: string,
  update: {
    bookId?: string | null;
    pageNumber?: number | null;
    durationIncrementSeconds?: number;
    eventType?: StudyEventType;
  }
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !sessionId) return false;

  const clampedIncrement = Math.min(
    Math.max(0, Math.round(update.durationIncrementSeconds || 0)),
    MAX_HEARTBEAT_SECONDS
  );

  // Fetch current session state
  const { data: session, error: fetchErr } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !session) return false;

  const now = new Date().toISOString();
  const currentDurationSeconds = (session.duration_seconds || 0) + clampedIncrement;
  const currentDurationMinutes = Math.floor(currentDurationSeconds / 60);

  const pagesViewedSet = new Set<number>(session.pages_viewed || []);
  const pagesCompletedSet = new Set<number>(session.pages_completed || []);

  if (update.pageNumber && update.pageNumber > 0) {
    pagesViewedSet.add(update.pageNumber);
    if (update.eventType === "page_completed") {
      pagesCompletedSet.add(update.pageNumber);
    }
  }

  const { error: updateErr } = await supabase
    .from("study_sessions")
    .update({
      ended_at: now,
      duration_seconds: currentDurationSeconds,
      duration_minutes: currentDurationMinutes,
      pages_viewed: Array.from(pagesViewedSet),
      pages_completed: Array.from(pagesCompletedSet),
      pages_read: pagesCompletedSet.size > 0 ? pagesCompletedSet.size : pagesViewedSet.size,
      updated_at: now,
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  return !updateErr;
}

/**
 * End an active study session
 */
export async function endStudySession(userId: string, sessionId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId || !sessionId) return false;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("study_sessions")
    .update({ ended_at: now, updated_at: now })
    .eq("id", sessionId)
    .eq("user_id", userId);

  return !error;
}

/**
 * Helper to calculate current and longest consecutive day streaks
 */
function calculateStreaks(dateStrings: string[]): { currentStreak: number; longestStreak: number } {
  if (!dateStrings || dateStrings.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Deduplicate and sort dates descending (newest first)
  const uniqueDates = Array.from(
    new Set(
      dateStrings
        .filter(Boolean)
        .map((d) => {
          try {
            return new Date(d).toISOString().split("T")[0];
          } catch {
            return null;
          }
        })
        .filter((d): d is string => Boolean(d))
    )
  ).sort().reverse();

  if (uniqueDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Current Streak Calculation
  let currentStreak = 0;
  const mostRecent = uniqueDates[0];
  if (mostRecent === todayStr || mostRecent === yesterdayStr) {
    currentStreak = 1;
    let expectedDate = new Date(mostRecent);
    for (let i = 1; i < uniqueDates.length; i++) {
      expectedDate = new Date(expectedDate.getTime() - 86400000);
      const expectedStr = expectedDate.toISOString().split("T")[0];
      if (uniqueDates[i] === expectedStr) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Longest Streak Calculation across all history
  // Sort ascending for historical sequential streak scanning
  const ascendingDates = [...uniqueDates].reverse();
  let longestStreak = 1;
  let runningStreak = 1;

  for (let i = 1; i < ascendingDates.length; i++) {
    const prevDate = new Date(ascendingDates[i - 1]);
    const currDate = new Date(ascendingDates[i]);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);

    if (diffDays === 1) {
      runningStreak++;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      runningStreak = 1;
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
  };
}

export async function getDashboardData(userId: string): Promise<StudentProgress> {
  return getProgressForUser(userId);
}

/**
 * Compute 100% data-driven progress from database records and real tracking events
 */
export async function getProgressForUser(userId: string): Promise<StudentProgress> {
  const supabase = await createServerSupabaseClient();
  const defaultProgress: StudentProgress = {
    totalStudyMinutes: 0,
    totalStudySeconds: 0,
    streakDays: 0,
    longestStreakDays: 0,
    chaptersCompleted: 0,
    totalChapters: 0,
    videosWatched: 0,
    quizzesCompleted: 0,
    questionsAsked: 0,
    flashcardsReviewed: 0,
    pagesRead: 0,
    bookProgressPercentage: 0,
    activeSubject: "",
    concepts: [],
    todayPlan: [],
    recentActivity: [],
  };

  if (!supabase || !userId) return defaultProgress;

  try {
    // 1. Fetch study sessions for exact time and pages
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("id, created_at, started_at, duration_seconds, duration_minutes, pages_read, pages_viewed, pages_completed, book_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // 2. Fetch tracking events
    const { data: events } = await supabase
      .from("study_events")
      .select("id, session_id, event_type, page_number, duration_seconds, metadata, created_at, book_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    // Calculate total study time accurately
    let totalStudySeconds = 0;
    const sessionIds = new Set<string>();

    if (sessions && sessions.length > 0) {
      for (const s of sessions) {
        sessionIds.add(s.id);
        const sessionSecs = s.duration_seconds || (s.duration_minutes ? s.duration_minutes * 60 : 0);
        totalStudySeconds += sessionSecs;
      }
    }

    // Add standalone events duration if not attached to a session
    if (events && events.length > 0) {
      for (const ev of events) {
        if (!ev.session_id || !sessionIds.has(ev.session_id)) {
          if (ev.event_type === "page_time" || ev.event_type === "video_watched") {
            totalStudySeconds += (ev.duration_seconds || 0);
          }
        }
      }
    }

    const totalStudyMinutes = Math.floor(totalStudySeconds / 60);

    // 3. Aggregate all real user activity timestamps to calculate streaks
    const activityDates: string[] = [];
    if (sessions) {
      sessions.forEach((s) => s.started_at && activityDates.push(s.started_at));
    }
    if (events) {
      events.forEach((e) => e.created_at && activityDates.push(e.created_at));
    }

    // 4. Fetch questions count from user messages joined via conversations
    const { data: userConvos } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", userId);

    let questionsAsked = 0;
    const convoIds = (userConvos || []).map((c) => c.id);
    if (convoIds.length > 0) {
      const { data: msgRows, count } = await supabase
        .from("messages")
        .select("id, created_at", { count: "exact" })
        .in("conversation_id", convoIds)
        .eq("sender", "user");
      questionsAsked = count || 0;
      if (msgRows) {
        msgRows.forEach((m) => m.created_at && activityDates.push(m.created_at));
      }
    }

    // 5. Fetch quiz attempts
    const { data: attempts, count: quizCount } = await supabase
      .from("quiz_attempts")
      .select("id, created_at, started_at", { count: "exact" })
      .eq("user_id", userId);

    if (attempts) {
      attempts.forEach((a) => (a.started_at || a.created_at) && activityDates.push(a.started_at || a.created_at));
    }

    // 6. Fetch flashcards review count
    const { count: flashcardsCount, data: flashcardRows } = await supabase
      .from("flashcards")
      .select("id, last_reviewed", { count: "exact" })
      .eq("user_id", userId)
      .not("last_reviewed", "is", null);

    if (flashcardRows) {
      flashcardRows.forEach((f) => f.last_reviewed && activityDates.push(f.last_reviewed));
    }

    const { currentStreak, longestStreak } = calculateStreaks(activityDates);

    // 7. Concepts from student_concepts joined to concepts table
    const { data: conceptsData } = await supabase
      .from("student_concepts")
      .select("*, concepts(name, category)")
      .eq("user_id", userId);

    // 8. Videos count
    const { count: videoCount } = await supabase
      .from("videos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    // 9. Active Book & Real Chapter Completion / Pages Read (NO FAKE FORMULAS!)
    const { data: latestBook } = await supabase
      .from("books")
      .select("id, title, subject, last_page_read, total_pages")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    let pagesRead = 0;
    let chaptersCompleted = 0;
    let totalChapters = 0;
    let bookProgressPercentage = 0;

    if (latestBook) {
      // Gather all distinct pages viewed or completed for this book from events & sessions
      const readPagesSet = new Set<number>();

      if (events) {
        events
          .filter((e) => e.book_id === latestBook.id && e.page_number && e.page_number > 0)
          .forEach((e) => readPagesSet.add(e.page_number!));
      }

      if (sessions) {
        sessions
          .filter((s) => s.book_id === latestBook.id)
          .forEach((s) => {
            (s.pages_completed || []).forEach((p: number) => readPagesSet.add(p));
            (s.pages_viewed || []).forEach((p: number) => readPagesSet.add(p));
          });
      }

      // If last_page_read is set on the book, ensure it is considered viewed
      if (latestBook.last_page_read && latestBook.last_page_read > 0) {
        readPagesSet.add(latestBook.last_page_read);
      }

      pagesRead = readPagesSet.size;
      const totalPages = Math.max(1, latestBook.total_pages || 1);
      bookProgressPercentage = Math.min(100, Math.round((pagesRead / totalPages) * 100));

      // Check genuine chapter completion against the chapters table
      const { data: chapters } = await supabase
        .from("chapters")
        .select("id, number, start_page, end_page")
        .eq("book_id", latestBook.id);

      if (chapters && chapters.length > 0) {
        totalChapters = chapters.length;
        for (const ch of chapters) {
          const start = ch.start_page;
          const end = ch.end_page;
          if (start && end && end >= start) {
            let allPagesInChapterRead = true;
            for (let p = start; p <= end; p++) {
              if (!readPagesSet.has(p)) {
                allPagesInChapterRead = false;
                break;
              }
            }
            if (allPagesInChapterRead) {
              chaptersCompleted++;
            }
          }
        }
      } else {
        chaptersCompleted = 0;
        totalChapters = 0;
      }
    }

    const concepts = (conceptsData || []).map((c: any) => {
      const attempted = c.questions_attempted || 0;
      const correct = c.questions_correct || 0;
      const calculatedMastery = attempted > 0
        ? Math.min(100, Math.max(0, Math.round((correct / attempted) * 100)))
        : (typeof c.mastery_percentage === "number" ? c.mastery_percentage : 0);
      const isWeak = attempted > 0 ? (calculatedMastery < 60) : false;

      return {
        id: c.id,
        name: c.concepts?.name || c.name || "Academic Concept",
        category: c.concepts?.category || c.category || "General Studies",
        masteryPercentage: calculatedMastery,
        questionsAttempted: attempted,
        questionsCorrect: correct,
        isWeak: Boolean(c.is_weak !== undefined ? c.is_weak : isWeak),
        recommendedChapter: c.recommended_chapter || "Chapter 1",
        recommendedPage: c.recommended_page || 1,
      };
    });

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

    const weakConcept = concepts.find((c) => c.isWeak && c.questionsAttempted > 0);
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

    if ((flashcardsCount || 0) > 0 || latestBook) {
      todayPlan.push({
        id: "plan-flashcards",
        title: "Daily Flashcard Retention Practice",
        type: "flashcards",
        target: "High-yield active recall deck",
        completed: false,
        estimatedMinutes: 10,
      });
    }

    // Format recent activity list from real tracking events
    const recentActivity = (events || []).slice(0, 10).map((ev) => {
      let title = "Studied textbook material";
      switch (ev.event_type) {
        case "page_opened":
          title = `Opened page ${ev.page_number || 1}`;
          break;
        case "page_time":
          title = `Read page ${ev.page_number || 1} for ${ev.duration_seconds || 0}s`;
          break;
        case "page_completed":
          title = `Completed page ${ev.page_number || 1}`;
          break;
        case "highlight_created":
          title = `Created highlight on page ${ev.page_number || 1}`;
          break;
        case "note_created":
          title = `Wrote note on page ${ev.page_number || 1}`;
          break;
        case "bookmark_created":
          title = `Bookmarked page ${ev.page_number || 1}`;
          break;
        case "question_asked":
          title = "Asked AI Tutor a question";
          break;
        case "quiz_started":
          title = "Started interactive quiz";
          break;
        case "quiz_completed":
          title = "Completed quiz assessment";
          break;
        case "flashcard_reviewed":
          title = "Practiced flashcard recall";
          break;
        case "video_watched":
          title = "Watched lecture segment";
          break;
        case "video_started":
          title = "Started lecture video";
          break;
      }

      return {
        id: ev.id,
        eventType: ev.event_type,
        title,
        timestamp: ev.created_at,
        pageNumber: ev.page_number || undefined,
        durationSeconds: ev.duration_seconds || undefined,
      };
    });

    return {
      totalStudyMinutes,
      totalStudySeconds,
      streakDays: currentStreak,
      longestStreakDays: longestStreak,
      chaptersCompleted,
      totalChapters,
      videosWatched: videoCount || 0,
      quizzesCompleted: quizCount || 0,
      questionsAsked: questionsAsked || 0,
      flashcardsReviewed: flashcardsCount || 0,
      pagesRead,
      bookProgressPercentage,
      activeSubject: latestBook?.subject || "",
      concepts,
      todayPlan,
      recentActivity,
    };
  } catch (err) {
    console.error("Progress calculation error:", err);
    return defaultProgress;
  }
}
