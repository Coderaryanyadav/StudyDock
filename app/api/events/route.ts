import { NextResponse } from "next/server";
import { verifyBookOwnership } from "@/lib/supabase/auth";
import { recordStudyEvent, startStudySession, heartbeatStudySession, endStudySession } from "@/lib/progress/service";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

export const runtime = "nodejs";

const VALID_EVENT_TYPES = [
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
] as const;

const eventsPostSchema = z.object({
  action: z.enum(["start_session", "heartbeat_session", "end_session"]).optional(),
  eventType: z.enum(VALID_EVENT_TYPES).optional(),
  bookId: z.string().min(1, "Invalid book ID format").optional().nullable(),
  sessionId: z.string().min(1, "Invalid session ID format").optional(),
  pageNumber: z.union([z.number(), z.string()]).optional().nullable(),
  durationSeconds: z.union([z.number(), z.string()]).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  activityType: z.string().max(100).optional(),
});

export const POST = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD, // Using 120/min limit to accommodate heartbeats
    bodySchema: eventsPostSchema,
  },
  async ({ userId, body }) => {
    const data = body as z.infer<typeof eventsPostSchema>;

    if (data.action === "start_session") {
      if (data.bookId) {
        const isOwner = await verifyBookOwnership(userId!, data.bookId);
        if (!isOwner) {
          return NextResponse.json({ error: "Access denied." }, { status: 403 });
        }
      }
      const session = await startStudySession(userId!, data.bookId || undefined, data.activityType || "reading");
      if (!session) {
        return NextResponse.json({ error: "Failed to start study session." }, { status: 500 });
      }
      return NextResponse.json({ success: true, session });
    }

    if (data.action === "heartbeat_session") {
      if (!data.sessionId) {
        return NextResponse.json({ error: "Session ID required for heartbeat." }, { status: 400 });
      }
      const ok = await heartbeatStudySession(userId!, data.sessionId, {
        bookId: data.bookId || undefined,
        pageNumber: data.pageNumber ? Number(data.pageNumber) : null,
        durationIncrementSeconds: data.durationSeconds ? Number(data.durationSeconds) : undefined,
        eventType: data.eventType as any,
      });
      return NextResponse.json({ success: ok });
    }

    if (data.action === "end_session") {
      if (!data.sessionId) {
        return NextResponse.json({ error: "Session ID required to end session." }, { status: 400 });
      }
      const ok = await endStudySession(userId!, data.sessionId);
      return NextResponse.json({ success: ok });
    }

    if (!data.eventType) {
      return NextResponse.json({ error: "Invalid or missing eventType." }, { status: 400 });
    }

    if (data.bookId) {
      const isOwner = await verifyBookOwnership(userId!, data.bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied. You do not own this book." }, { status: 403 });
      }
    }

    const recordedEvent = await recordStudyEvent(userId!, {
      bookId: data.bookId || undefined,
      sessionId: data.sessionId,
      eventType: data.eventType as any,
      pageNumber: data.pageNumber ? Number(data.pageNumber) : null,
      durationSeconds: data.durationSeconds ? Number(data.durationSeconds) : 0,
      metadata: data.metadata,
    });

    if (!recordedEvent) {
      return NextResponse.json({ error: "Failed to persist study event." }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: recordedEvent });
  }
);
