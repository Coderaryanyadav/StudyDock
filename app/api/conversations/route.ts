import { NextResponse } from "next/server";
import { verifyBookOwnership } from "@/lib/supabase/auth";
import { getConversationsForUser, createConversation } from "@/lib/conversations/service";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

export const runtime = "nodejs";

const getConversationsSchema = z.object({
  bookId: z.string().min(1, "Invalid book ID format"),
  limit: z.union([z.string(), z.number()]).optional().transform((v) => Number(v) || 50),
  offset: z.union([z.string(), z.number()]).optional().transform((v) => Number(v) || 0),
});

const postConversationSchema = z.object({
  bookId: z.string().min(1, "Invalid book ID format"),
  title: z.string().max(255).optional(),
});

export const GET = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    querySchema: getConversationsSchema,
  },
  async ({ userId, query }) => {
    const { bookId, limit, offset } = query as z.infer<typeof getConversationsSchema>;

    const isOwner = await verifyBookOwnership(userId!, bookId);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Access denied. You do not have permission to access conversations for this book." },
        { status: 403 }
      );
    }

    const conversations = await getConversationsForUser(userId!, bookId, limit, offset);
    return NextResponse.json({ success: true, conversations, limit, offset });
  }
);

export const POST = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    bodySchema: postConversationSchema,
  },
  async ({ userId, body }) => {
    const { bookId, title } = body as z.infer<typeof postConversationSchema>;

    const isOwner = await verifyBookOwnership(userId!, bookId);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Access denied. You do not have permission to create conversations for this book." },
        { status: 403 }
      );
    }

    const conversation = await createConversation(userId!, bookId, title);
    return NextResponse.json({ success: true, conversation }, { status: 201 });
  }
);
