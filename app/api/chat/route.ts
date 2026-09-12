import { NextRequest, NextResponse } from "next/server";
import { LearningMode, Book, VideoLecture } from "@/types";
import { retrieveRelevantContext } from "@/lib/rag/retriever";
import { streamTutorResponse } from "@/lib/gemini/client";
import { checkRateLimit, validateChatInput } from "@/lib/security/rate-limit";
import { authenticateRequest, verifyBookOwnership, verifyConversationOwnership } from "@/lib/supabase/auth";
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

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required to query the AI Tutor." },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Support dedicated action to create a new conversation thread
    if (body.action === "create_conversation") {
      const { bookId, title } = body;
      if (!bookId) {
        return NextResponse.json({ error: "Book ID is required." }, { status: 400 });
      }
      const isOwner = await verifyBookOwnership(userId, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }
      const newConv = await createConversation(userId, bookId, title);
      return NextResponse.json({ success: true, conversation: newConv });
    }

    // Rate Limiting: Max 30 chat requests per minute per IP
    const ip = req.headers.get("x-forwarded-for") || "local-client";
    const limitCheck = checkRateLimit(`chat-${ip}`, { limit: 30, windowMs: 60 * 1000 });
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "Too many AI Tutor requests. Please pause before sending another question." },
        { status: 429, headers: { "Retry-After": limitCheck.resetInSec.toString() } }
      );
    }

    // Validate input constraints
    const validation = validateChatInput(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error || "Invalid request parameters." },
        { status: 400 }
      );
    }

    const {
      question,
      pageNumber = 1,
      selectedText,
      learningMode = "explain",
      videoTimestampSeconds,
      bookId,
      conversationId,
    } = body;

    if (!bookId) {
      return NextResponse.json({ error: "Book ID is required." }, { status: 400 });
    }

    // Verify ownership of the book
    const isOwner = await verifyBookOwnership(userId, bookId);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Access denied. You do not have permission to query this textbook." },
        { status: 403 }
      );
    }

    // If conversation ID is specified, verify ownership
    let activeConvId = conversationId;
    if (activeConvId) {
      const isConvOwner = await verifyConversationOwnership(userId, activeConvId, bookId);
      if (!isConvOwner) {
        return NextResponse.json(
          { error: "Access denied. You do not have permission to access this conversation." },
          { status: 403 }
        );
      }
    } else {
      // Create new conversation automatically if none active
      const newConv = await createConversation(userId, bookId, question.slice(0, 50));
      if (newConv) {
        activeConvId = newConv.id;
      }
    }

    // Resolve Target Book Context Authoritatively from Database
    const targetBook: Book | null = await getBookForUser(userId, bookId);
    let targetVideo: VideoLecture | undefined = undefined;

    if (!targetBook) {
      return NextResponse.json(
        { error: "Target book could not be found or you do not have permission to access it." },
        { status: 404 }
      );
    }

    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data: bookRecord } = await supabase
        .from("books")
        .select("youtube_url, video_title")
        .eq("id", bookId)
        .eq("user_id", userId)
        .single();

      if (bookRecord?.youtube_url) {
        const match = bookRecord.youtube_url.match(
          /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
        );
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

    if (!targetBook) {
      return NextResponse.json(
        { error: "Target book could not be found or database is unavailable." },
        { status: 404 }
      );
    }

    // Fail-Closed Grounded RAG Context Retrieval
    const ragContext = await retrieveRelevantContext(
      question,
      targetBook,
      pageNumber,
      selectedText,
      targetVideo,
      videoTimestampSeconds,
      userId
    );

    // Save user message immediately to conversation
    if (activeConvId) {
      await saveMessage(userId, activeConvId, "user", question, learningMode);
      // Log tracking event
      await recordStudyEvent(userId, {
        bookId,
        eventType: "question_asked",
        pageNumber: Number(pageNumber) || 1,
        metadata: { conversationId: activeConvId, learningMode },
      }).catch(() => {});
    }

    // Streaming Response with SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamTutorResponse(
            question,
            ragContext,
            learningMode as LearningMode,
            {
              onChunk: (chunk) => {
                const payload = JSON.stringify({ type: "chunk", text: chunk });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
              },
              onComplete: async (fullText) => {
                // Save AI Assistant response message and citations to database
                if (activeConvId) {
                  await saveMessage(
                    userId,
                    activeConvId,
                    "ai",
                    fullText,
                    learningMode,
                    ragContext.citations
                  );
                }

                const payload = JSON.stringify({
                  type: "done",
                  fullText,
                  conversationId: activeConvId,
                  citations: ragContext.citations,
                  retrievalMode: ragContext.retrievalMode,
                  suggestedFollowUps: [
                    "Explain simpler",
                    "Give real-world example",
                    "Quiz me on this",
                    "Create flashcards",
                  ],
                });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                controller.close();
              },
              onError: (err) => {
                const payload = JSON.stringify({
                  type: "error",
                  error: "An error occurred while generating the tutor explanation.",
                });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                controller.close();
              },
            }
          );
        } catch (streamError: any) {
          const payload = JSON.stringify({
            type: "error",
            error: "Failed to generate AI response. Please try again.",
          });
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
    });
  } catch (error: any) {
    console.error("Chat API error:", error?.message || error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get("bookId");
    const conversationId = searchParams.get("conversationId");
    const listOnly = searchParams.get("list") === "true";

    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!bookId) {
      return NextResponse.json({ error: "Book ID is required." }, { status: 400 });
    }

    const isOwner = await verifyBookOwnership(userId, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    // Return conversation list for this book
    if (listOnly) {
      const conversations = await getConversationsForUser(userId, bookId);
      return NextResponse.json({ success: true, conversations });
    }

    // Return messages for a specific conversation ID
    if (conversationId) {
      const isConvOwner = await verifyConversationOwnership(userId, conversationId, bookId);
      if (!isConvOwner) {
        return NextResponse.json({ error: "Access denied to this conversation." }, { status: 403 });
      }
      const record = await getConversationWithMessages(userId, conversationId);
      return NextResponse.json({
        success: true,
        conversationId: record?.id || conversationId,
        title: record?.title,
        messages: record?.messages || [],
      });
    }

    // Default: find the latest active conversation for this book
    const conversations = await getConversationsForUser(userId, bookId);
    if (conversations.length === 0) {
      return NextResponse.json({
        success: true,
        conversationId: null,
        conversations: [],
        messages: [],
      });
    }

    const latestConv = conversations[0];
    const record = await getConversationWithMessages(userId, latestConv.id);

    return NextResponse.json({
      success: true,
      conversationId: latestConv.id,
      title: latestConv.title,
      conversations,
      messages: record?.messages || [],
    });
  } catch (error: any) {
    console.error("Fetch chat history error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch chat history." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, title } = body;

    if (!conversationId || !title) {
      return NextResponse.json({ error: "Conversation ID and title are required." }, { status: 400 });
    }

    const updated = await renameConversation(userId, conversationId, title);
    if (!updated) {
      return NextResponse.json({ error: "Failed to rename conversation." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Rename conversation error:", error?.message || error);
    return NextResponse.json({ error: "Failed to rename conversation." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required." }, { status: 400 });
    }

    const deleted = await deleteConversation(userId, conversationId);
    if (!deleted) {
      return NextResponse.json({ error: "Failed to delete conversation." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete conversation error:", error?.message || error);
    return NextResponse.json({ error: "Failed to delete conversation." }, { status: 500 });
  }
}
