import { NextResponse } from "next/server";
import { verifyConversationOwnership } from "@/lib/supabase/auth";
import {
  getConversationWithMessages,
  renameConversation,
  deleteConversation,
} from "@/lib/conversations/service";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

export const runtime = "nodejs";

const conversationParamsSchema = z.object({
  id: z.string().string().min(1, "Invalid conversation ID format"),
});

const getConversationQuerySchema = z.object({
  bookId: z.string().string().min(1, "Invalid book ID format").optional(),
});

const patchConversationSchema = z.object({
  title: z.string().min(1).max(255),
  bookId: z.string().string().min(1, "Invalid book ID format").optional(),
});

const deleteConversationQuerySchema = z.object({
  bookId: z.string().string().min(1, "Invalid book ID format").optional(),
});

export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;

  return withApiHandler(
    {
      requireAuth: true,
      rateLimit: RATE_LIMITS.STANDARD,
      querySchema: getConversationQuerySchema,
    },
    async ({ userId, query }) => {
      const parseResult = conversationParamsSchema.safeParse(resolvedParams);
      if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid conversation ID", details: parseResult.error.errors }, { status: 400 });
      }
      const conversationId = parseResult.data.id;

      const { bookId: expectedBookId } = query as z.infer<typeof getConversationQuerySchema>;

      const isOwner = await verifyConversationOwnership(userId!, conversationId, expectedBookId);
      if (!isOwner) {
        return NextResponse.json(
          { error: "Access denied or conversation does not exist." },
          { status: 404 }
        );
      }

      const record = await getConversationWithMessages(userId!, conversationId, expectedBookId);
      if (!record) {
        return NextResponse.json(
          { error: "Conversation not found." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        conversationId: record.id,
        bookId: record.bookId,
        title: record.title,
        createdAt: record.createdAt,
        messages: record.messages,
      });
    }
  )(req as any);
};

export const PATCH = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;

  return withApiHandler(
    {
      requireAuth: true,
      rateLimit: RATE_LIMITS.STANDARD,
      bodySchema: patchConversationSchema,
    },
    async ({ userId, body }) => {
      const parseResult = conversationParamsSchema.safeParse(resolvedParams);
      if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid conversation ID", details: parseResult.error.errors }, { status: 400 });
      }
      const conversationId = parseResult.data.id;

      const { title, bookId } = body as z.infer<typeof patchConversationSchema>;

      const isOwner = await verifyConversationOwnership(userId!, conversationId, bookId);
      if (!isOwner) {
        return NextResponse.json(
          { error: "Access denied. You do not have permission to rename this conversation." },
          { status: 403 }
        );
      }

      const updated = await renameConversation(userId!, conversationId, title, bookId);
      if (!updated) {
        return NextResponse.json(
          { error: "Failed to update conversation title in database." },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, conversationId, title: title.trim() });
    }
  )(req as any);
};

export const DELETE = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;

  return withApiHandler(
    {
      requireAuth: true,
      rateLimit: RATE_LIMITS.STANDARD,
      querySchema: deleteConversationQuerySchema,
    },
    async ({ userId, query }) => {
      const parseResult = conversationParamsSchema.safeParse(resolvedParams);
      if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid conversation ID", details: parseResult.error.errors }, { status: 400 });
      }
      const conversationId = parseResult.data.id;

      const { bookId: expectedBookId } = query as z.infer<typeof deleteConversationQuerySchema>;

      const isOwner = await verifyConversationOwnership(userId!, conversationId, expectedBookId);
      if (!isOwner) {
        return NextResponse.json(
          { error: "Access denied. You do not have permission to delete this conversation." },
          { status: 403 }
        );
      }

      const deleted = await deleteConversation(userId!, conversationId, expectedBookId);
      if (!deleted) {
        return NextResponse.json(
          { error: "Failed to delete conversation from database." },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, conversationId });
    }
  )(req as any);
};
