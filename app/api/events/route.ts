import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { recordStudyEvent, startStudySession, heartbeatStudySession, endStudySession } from "@/lib/progress/service";
import { StudyEventType } from "@/types";

const VALID_EVENT_TYPES: StudyEventType[] = [
  "page_opened",
  "page_time",
  "page_completed",
  "highlight_created",
  "note_created",
  "bookmark_created",
  "video_started",
  "video_watched",
  "question_asked",
  "quiz_started",
  "quiz_completed",
  "flashcard_reviewed",
];

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json();
    const { action, eventType, bookId, sessionId, pageNumber, durationSeconds, metadata, activityType } = body;

    // 1. Dedicated session actions
    if (action === "start_session") {
      if (bookId) {
        const isOwner = await verifyBookOwnership(userId, bookId);
        if (!isOwner) {
          return NextResponse.json({ error: "Access denied." }, { status: 403 });
        }
      }
      const session = await startStudySession(userId, bookId, activityType || "reading");
      if (!session) {
        return NextResponse.json({ error: "Failed to start study session." }, { status: 500 });
      }
      return NextResponse.json({ success: true, session });
    }

    if (action === "heartbeat_session") {
      if (!sessionId) {
        return NextResponse.json({ error: "Session ID required for heartbeat." }, { status: 400 });
      }
      const ok = await heartbeatStudySession(userId, sessionId, {
        bookId,
        pageNumber: pageNumber ? Number(pageNumber) : null,
        durationIncrementSeconds: durationSeconds,
        eventType,
      });
      return NextResponse.json({ success: ok });
    }

    if (action === "end_session") {
      if (!sessionId) {
        return NextResponse.json({ error: "Session ID required to end session." }, { status: 400 });
      }
      const ok = await endStudySession(userId, sessionId);
      return NextResponse.json({ success: ok });
    }

    // 2. Standard Study Event recording
    if (!eventType || !VALID_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid or missing eventType. Must be one of: ${VALID_EVENT_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (bookId) {
      const isOwner = await verifyBookOwnership(userId, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied. You do not own this book." }, { status: 403 });
      }
    }

    const recordedEvent = await recordStudyEvent(userId, {
      bookId,
      sessionId,
      eventType,
      pageNumber: pageNumber ? Number(pageNumber) : null,
      durationSeconds: durationSeconds ? Number(durationSeconds) : 0,
      metadata,
    });

    if (!recordedEvent) {
      return NextResponse.json({ error: "Failed to persist study event." }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: recordedEvent });
  } catch (error: any) {
    console.error("Study event tracking error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to record tracking event." },
      { status: 500 }
    );
  }
}
