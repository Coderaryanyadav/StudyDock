import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/progress/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const progress = await getDashboardData(userId);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: userId,
        email: auth?.email,
        displayName: auth?.displayName || "Scholar",
      },
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

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json();
    const { bookId, durationSeconds, pagesRead, videoSeconds, questionsAsked, pageNumber } = body;

    let authorizedBookId: string | null = null;
    if (bookId) {
      const isOwner = await verifyBookOwnership(userId, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied. You do not own this textbook." }, { status: 403 });
      }
      authorizedBookId = bookId;
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable." }, { status: 500 });
    }

    // Clamp duration per heartbeat to prevent manufactured unlimited study time
    const rawSeconds = Math.max(0, Math.round(durationSeconds || 0));
    const clampedSeconds = Math.min(rawSeconds, 300); // 5 min max cap per request
    const calculatedMinutes = Math.floor(clampedSeconds / 60);

    const pagesViewed = (pageNumber && pageNumber > 0) ? [Number(pageNumber)] : [];
    const now = new Date().toISOString();

    const { error: insertErr } = await supabase.from("study_sessions").insert({
      user_id: userId,
      book_id: authorizedBookId,
      duration_seconds: clampedSeconds,
      duration_minutes: calculatedMinutes,
      pages_read: pagesRead ? Number(pagesRead) : pagesViewed.length,
      pages_viewed: pagesViewed,
      video_time_seconds: Math.min(Math.max(0, Number(videoSeconds || 0)), 300),
      questions_asked: questionsAsked || 0,
      created_at: now,
      started_at: now,
      ended_at: now,
    });

    if (insertErr) {
      return NextResponse.json({ error: "Failed to record study session." }, { status: 500 });
    }

    // Also record real study event
    if (clampedSeconds > 0) {
      await supabase.from("study_events").insert({
        user_id: userId,
        book_id: authorizedBookId,
        event_type: "page_time",
        page_number: pageNumber ? Number(pageNumber) : null,
        duration_seconds: clampedSeconds,
        created_at: now,
      });
    }

    return NextResponse.json({ success: true, durationSeconds: clampedSeconds });
  } catch (error: any) {
    console.error("Progress recording error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to record study session." },
      { status: 500 }
    );
  }
}
