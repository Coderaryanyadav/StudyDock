import { NextResponse } from "next/server";
import { verifyBookOwnership } from "@/lib/supabase/auth";
import {
  attachVideoToBook,
  getVideosForBook,
  detachVideoFromBook,
} from "@/lib/videos/service";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

const bookParamsSchema = z.object({
  id: z.string().string().min(1, "Invalid book ID format"),
});

const videoPostSchema = z.object({
  youtubeUrl: z
    .string()
    .url("Must be a valid URL")
    .max(500)
    .refine((val) => {
      // Basic SSRF and domain restrictions
      const url = new URL(val);
      const host = url.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host.includes("internal")) return false;
      if (url.protocol === "file:" || url.protocol === "javascript:") return false;
      if (!host.includes("youtube.com") && !host.includes("youtu.be")) return false;
      return true;
    }, "Must be a valid public YouTube URL"),
  title: z.string().max(255).optional(),
});

const videoDeleteSchema = z.object({
  videoId: z.string().string().min(1).optional(),
});

export const POST = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;

  return withApiHandler(
    {
      requireAuth: true,
      rateLimit: RATE_LIMITS.STANDARD,
      bodySchema: videoPostSchema,
    },
    async ({ userId, body }) => {
      const parseResult = bookParamsSchema.safeParse(resolvedParams);
      if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid book ID", details: parseResult.error.errors }, { status: 400 });
      }
      const bookId = parseResult.data.id;

      const isOwner = await verifyBookOwnership(userId!, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }

      const { youtubeUrl, title } = body as z.infer<typeof videoPostSchema>;

      const video = await attachVideoToBook(userId!, bookId, youtubeUrl, title);
      if (!video) {
        return NextResponse.json({ error: "Invalid YouTube URL or failed to attach video." }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        video,
      });
    }
  )(req as any);
};

export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;

  return withApiHandler(
    {
      requireAuth: true,
      rateLimit: RATE_LIMITS.STANDARD,
    },
    async ({ userId }) => {
      const parseResult = bookParamsSchema.safeParse(resolvedParams);
      if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid book ID", details: parseResult.error.errors }, { status: 400 });
      }
      const bookId = parseResult.data.id;

      const isOwner = await verifyBookOwnership(userId!, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }

      const videos = await getVideosForBook(userId!, bookId);
      const video = videos.length > 0 ? videos[0] : null;

      return NextResponse.json({
        success: true,
        video,
      });
    }
  )(req as any);
};

export const DELETE = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;

  return withApiHandler(
    {
      requireAuth: true,
      rateLimit: RATE_LIMITS.STANDARD,
      querySchema: videoDeleteSchema,
    },
    async ({ userId, query }) => {
      const parseResult = bookParamsSchema.safeParse(resolvedParams);
      if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid book ID", details: parseResult.error.errors }, { status: 400 });
      }
      const bookId = parseResult.data.id;

      const isOwner = await verifyBookOwnership(userId!, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }

      const { videoId } = query as z.infer<typeof videoDeleteSchema>;

      const videos = await getVideosForBook(userId!, bookId);
      const targetId = videoId || (videos.length > 0 ? videos[0].id : null);

      if (targetId) {
        await detachVideoFromBook(userId!, targetId, bookId);
      }

      return NextResponse.json({ success: true });
    }
  )(req as any);
};
