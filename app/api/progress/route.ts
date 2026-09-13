import { NextResponse } from "next/server";
import { verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardData, recordStudyEvent } from "@/lib/progress/service";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

export const runtime = "nodejs";

const progressPostSchema = z.object({
  bookId: z.string().string().min(1, "Invalid book ID format").optional().nullable(),
  durationSeconds: z.number().optional(),
  pagesRead: z.number().optional(),
  videoSeconds: z.number().optional(),
  questionsAsked: z.number().optional(),
  pageNumber: z.union([z.number(), z.string()]).optional().nullable(),
});

export const GET = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
  },
  async ({ userId, req }) => {
    // We already have auth from requireAuth, but need displayName from original auth fetch.
    // However getDashboardData needs userId.
    const progress = await getDashboardData(userId!);

    // Re-fetch auth for display name if needed since withApiHandler only gives userId
    const { authenticateRequest } = await import("@/lib/supabase/auth");
    const auth = await authenticateRequest(req as any);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: userId,
        email: auth?.email,
        displayName: auth?.displayName || "Scholar",
      },
      ...progress,
    });
  }
);

export const POST = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    bodySchema: progressPostSchema,
  },
  async ({ userId, body }) => {
    const data = body as z.infer<typeof progressPostSchema>;

    let authorizedBookId: string | null = null;
    if (data.bookId) {
      const isOwner = await verifyBookOwnership(userId!, data.bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied. You do not own this textbook." }, { status: 403 });
      }
      authorizedBookId = data.bookId;
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable." }, { status: 500 });
    }

    const rawSeconds = Math.max(0, Math.round(data.durationSeconds || 0));
    const clampedSeconds = Math.min(rawSeconds, 300); // 5 min max cap per request

    if (clampedSeconds > 0) {
      await recordStudyEvent(userId!, {
        bookId: authorizedBookId || undefined,
        eventType: "page_time",
        pageNumber: data.pageNumber ? Number(data.pageNumber) : null,
        durationSeconds: clampedSeconds,
      });
    }

    return NextResponse.json({ success: true, durationSeconds: clampedSeconds });
  }
);
