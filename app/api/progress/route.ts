import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({
        authenticated: false,
        streakDays: 5,
        totalStudyMinutes: 142,
        questionsAsked: 28,
        conceptsMastered: 14,
      });
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({
        authenticated: true,
        streakDays: 5,
        totalStudyMinutes: 142,
        questionsAsked: 28,
        conceptsMastered: 14,
      });
    }

    // Fetch user study sessions
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", userId);

    const totalMinutes = (sessions || []).reduce(
      (sum: number, s: any) => sum + (s.duration_minutes || s.duration_seconds / 60 || 0),
      0
    );

    // Fetch student concept mastery
    const { data: concepts } = await supabase
      .from("student_concepts")
      .select("*")
      .eq("user_id", userId);

    return NextResponse.json({
      authenticated: true,
      streakDays: 5,
      totalStudyMinutes: Math.round(totalMinutes),
      sessionsCount: sessions?.length || 0,
      concepts: concepts || [],
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
