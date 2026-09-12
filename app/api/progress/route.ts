import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({
        authenticated: false,
        streakDays: 0,
        totalStudyMinutes: 0,
        questionsAsked: 0,
        conceptsMastered: 0,
        concepts: [],
      });
    }

    const supabase = await createServerSupabaseClient() || createAdminClient();
    if (!supabase) {
      return NextResponse.json({
        authenticated: true,
        streakDays: 0,
        totalStudyMinutes: 0,
        questionsAsked: 0,
        conceptsMastered: 0,
        concepts: [],
      });
    }

    // Fetch user study sessions
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const totalMinutes = (sessions || []).reduce(
      (sum: number, s: any) => sum + (s.duration_minutes || (s.duration_seconds ? s.duration_seconds / 60 : 0) || 0),
      0
    );

    const totalQuestions = (sessions || []).reduce(
      (sum: number, s: any) => sum + (s.questions_asked || 0),
      0
    );

    // Calculate actual consecutive study day streak
    let streakDays = 0;
    if (sessions && sessions.length > 0) {
      const dates: string[] = Array.from(
        new Set(
          sessions
            .filter((s: any) => s.created_at)
            .map((s: any) => new Date(s.created_at as string).toISOString().split("T")[0])
        )
      ).sort().reverse();

      if (dates.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        
        let currentDate: string | null = (dates[0] === today || dates[0] === yesterday) ? dates[0] : null;
        if (currentDate) {
          streakDays = 1;
          for (let i = 1; i < dates.length; i++) {
            const prevExpected = new Date(new Date(currentDate as string).getTime() - 86400000).toISOString().split("T")[0];
            if (dates[i] === prevExpected) {
              streakDays++;
              currentDate = dates[i];
            } else {
              break;
            }
          }
        }
      }
    }

    // Fetch student concept mastery
    const { data: concepts } = await supabase
      .from("student_concepts")
      .select("*")
      .eq("user_id", userId);

    const masteredCount = (concepts || []).filter((c: any) => (c.mastery_percentage || 0) >= 80).length;

    return NextResponse.json({
      authenticated: true,
      streakDays,
      totalStudyMinutes: Math.round(totalMinutes),
      questionsAsked: totalQuestions,
      conceptsMastered: masteredCount,
      sessionsCount: sessions?.length || 0,
      concepts: (concepts || []).map((c: any) => ({
        id: c.id,
        name: c.name || c.concept_name,
        category: c.category || "General",
        masteryPercentage: c.mastery_percentage || 0,
        questionsAttempted: c.questions_attempted || 0,
        questionsCorrect: c.questions_correct || 0,
        isWeak: (c.mastery_percentage || 0) < 60,
        recommendedChapter: c.recommended_chapter || "Review",
        recommendedPage: c.recommended_page || 1,
      })),
    });
  } catch (error: any) {
    console.error("Progress fetch error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to fetch study progress." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;
    const body = await req.json();
    const { bookId, durationSeconds, pagesRead, videoSeconds, questionsAsked } = body;

    if (userId) {
      let authorizedBookId: string | null = null;
      if (bookId && !bookId.startsWith("demo-")) {
        const isOwner = await verifyBookOwnership(userId, bookId);
        if (isOwner) {
          authorizedBookId = bookId;
        }
      }

      const supabase = await createServerSupabaseClient();
      if (supabase) {
        await supabase.from("study_sessions").insert({
          user_id: userId,
          book_id: authorizedBookId,
          duration_minutes: Math.round((durationSeconds || 0) / 60),
          pages_read: pagesRead || 0,
          video_time_seconds: videoSeconds || 0,
          questions_asked: questionsAsked || 0,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Progress recording error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to record study session." },
      { status: 500 }
    );
  }
}
