import { NextResponse } from "next/server";
import { LearningMode, Book, VideoLecture } from "@/types";
import { retrieveRelevantContext } from "@/lib/rag/retriever";
import { streamTutorResponse } from "@/lib/gemini/client";
import { verifyBookOwnership, verifyConversationOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getConversationsForUser,
  getConversationWithMessages,
  createConversation,
  renameConversation,
  deleteConversation,
  saveMessage,
} from "@/lib/conversations/service";
import { getBookForUser } from "@/lib/books/service";
import { recordStudyEvent } from "@/lib/progress/service";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

export const runtime = "nodejs";

const chatPostSchema = z.object({
  action: z.enum(["create_conversation", "send_message"]).optional(),
  bookId: z.string().string().min(1, "Invalid book ID"),
  title: z.string().max(255).optional(), // For create_conversation
  question: z.string().max(2000).optional(),
  message: z.string().max(2000).optional(),
  pageNumber: z.number().int().min(1).optional(),
  selectedText: z.string().max(5000).optional(),
  learningMode: z.enum(["explain", "summarize", "quiz", "flashcards", "socratic", "analyze"]).optional(),
  videoTimestampSeconds: z.number().min(0).optional(),
  conversationId: z.string().string().min(1).optional(),
});

const chatGetSchema = z.object({
  bookId: z.string().string().min(1),
  conversationId: z.string().string().min(1).optional(),
  list: z.enum(["true", "false"]).optional(),
});

const chatPatchSchema = z.object({
  conversationId: z.string().string().min(1),
  title: z.string().min(1).max(255),
});

const chatDeleteSchema = z.object({
  conversationId: z.string().string().min(1),
});

export const POST = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.AI_GENERATION, // 10 per minute
    bodySchema: chatPostSchema,
  },
  async ({ userId, body }) => {
    const data = body as z.infer<typeof chatPostSchema>;

    if (data.action === "create_conversation") {
      const isOwner = await verifyBookOwnership(userId!, data.bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }
      const newConv = await createConversation(userId!, data.bookId, data.title || "New Conversation");
      return NextResponse.json({ success: true, conversation: newConv });
    }

    const rawQ = data.question || data.message || "";
    const question = rawQ.trim();
    if (!question) {
      return NextResponse.json({ error: "Question cannot be empty." }, { status: 400 });
    }

    const isOwner = await verifyBookOwnership(userId!, data.bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    let activeConvId = data.conversationId;
    if (activeConvId) {
      const isConvOwner = await verifyConversationOwnership(userId!, activeConvId, data.bookId);
      if (!isConvOwner) {
        return NextResponse.json({ error: "Access denied to conversation." }, { status: 403 });
      }
    } else {
      const newConv = await createConversation(userId!, data.bookId, question.slice(0, 50));
      if (newConv) {
        activeConvId = newConv.id;
      }
    }

    const targetBook: Book | null = await getBookForUser(userId!, data.bookId);
    if (!targetBook) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    let targetVideo: VideoLecture | undefined = undefined;
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data: bookRecord } = await supabase
        .from("books")
        .select("youtube_url, video_title")
        .eq("id", data.bookId)
        .eq("user_id", userId)
        .single();

      if (bookRecord?.youtube_url) {
        const match = bookRecord.youtube_url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        if (match) {
          targetVideo = {
            id: `vid-${match[1]}`,
            youtubeId: match[1],
            title: bookRecord.video_title || `Lecture (${match[1]})`,
            channelName: null,
            durationSeconds: 0,
            formattedDuration: "00:00",
            bookId: targetBook.id,
            topics: [],
          };
        }
      }
    }

    const ragContext = await retrieveRelevantContext(
      question,
      targetBook,
      data.pageNumber || 1,
      data.selectedText,
      targetVideo,
      data.videoTimestampSeconds,
      userId!
    );

    if (activeConvId) {
      await saveMessage(userId!, activeConvId, "user", question, data.learningMode || "explain");
      await recordStudyEvent(userId!, {
        bookId: data.bookId,
        eventType: "question_asked",
        pageNumber: data.pageNumber || 1,
        metadata: { conversationId: activeConvId, learningMode: data.learningMode },
      }).catch(() => {});
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamTutorResponse(
            question,
            ragContext,
            (data.learningMode as LearningMode) || "explain",
            {
              onChunk: (chunk) => {
                const payload = JSON.stringify({ type: "chunk", text: chunk });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
              },
              onComplete: async (fullText) => {
                if (activeConvId) {
                  await saveMessage(
                    userId!,
                    activeConvId,
                    "ai",
                    fullText,
                    data.learningMode || "explain",
                    ragContext.citations
                  );
                }
                const payload = JSON.stringify({
                  type: "done",
                  fullText,
                  conversationId: activeConvId,
                  citations: ragContext.citations,
                  retrievalMode: ragContext.retrievalMode,
                  suggestedFollowUps: ["Explain simpler", "Give real-world example", "Quiz me on this", "Create flashcards"],
                });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                controller.close();
              },
              onError: (err) => {
                const payload = JSON.stringify({ type: "error", error: "An error occurred." });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                controller.close();
              },
            }
          );
        } catch (streamError) {
          const payload = JSON.stringify({ type: "error", error: "Failed to generate AI response." });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    }) as any;
  }
);

export const GET = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    querySchema: chatGetSchema,
  },
  async ({ userId, query }) => {
    const { bookId, conversationId, list } = query as z.infer<typeof chatGetSchema>;
    const listOnly = list === "true";

    const isOwner = await verifyBookOwnership(userId!, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    if (listOnly) {
      const conversations = await getConversationsForUser(userId!, bookId);
      return NextResponse.json({ success: true, conversations });
    }

    if (conversationId) {
      const isConvOwner = await verifyConversationOwnership(userId!, conversationId, bookId);
      if (!isConvOwner) {
        return NextResponse.json({ error: "Access denied to this conversation." }, { status: 403 });
      }
      const record = await getConversationWithMessages(userId!, conversationId);
      return NextResponse.json({
        success: true,
        conversationId: record?.id || conversationId,
        title: record?.title,
        messages: record?.messages || [],
      });
    }

    const conversations = await getConversationsForUser(userId!, bookId);
    if (conversations.length === 0) {
      return NextResponse.json({
        success: true,
        conversationId: null,
        conversations: [],
        messages: [],
      });
    }

    const latestConv = conversations[0];
    const record = await getConversationWithMessages(userId!, latestConv.id);

    return NextResponse.json({
      success: true,
      conversationId: latestConv.id,
      title: latestConv.title,
      conversations,
      messages: record?.messages || [],
    });
  }
);

export const PATCH = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    bodySchema: chatPatchSchema,
  },
  async ({ userId, body }) => {
    const { conversationId, title } = body as z.infer<typeof chatPatchSchema>;
    const updated = await renameConversation(userId!, conversationId, title);
    if (!updated) {
      return NextResponse.json({ error: "Failed to rename conversation." }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }
);

export const DELETE = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
    querySchema: chatDeleteSchema,
  },
  async ({ userId, query }) => {
    const { conversationId } = query as z.infer<typeof chatDeleteSchema>;
    const deleted = await deleteConversation(userId!, conversationId);
    if (!deleted) {
      return NextResponse.json({ error: "Failed to delete conversation." }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }
);
