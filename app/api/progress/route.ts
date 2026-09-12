import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDashboardData } from "@/lib/progress/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({
        authenticated: false,
        streakDays: 0,
        totalStudyMinutes: 0,
        quizzesCompleted: 0,
        questionsAsked: 0,
        chaptersCompleted: 0,
        videosWatched: 0,
        activeSubject: "Computer Science",
        concepts: [],
        todayPlan: [],
      });
    }

    const progress = await getDashboardData(userId);

    return NextResponse.json({
      authenticated: true,
      ...progress,
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

      const supabase = (await createServerSupabaseClient()) || createAdminClient();
      if (supabase) {
        await supabase.from("study_sessions").insert({
          user_id: userId,
          book_id: authorizedBookId,
          duration_minutes: Math.max(1, Math.round((durationSeconds || 0) / 60)),
          pages_read: pagesRead || 0,
          video_time_seconds: videoSeconds || 0,
          questions_asked: questionsAsked || 0,
          created_at: new Date().toISOString(),
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
