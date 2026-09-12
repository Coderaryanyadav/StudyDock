import { NextRequest, NextResponse } from "next/server";
import { LearningMode, Book, VideoLecture } from "@/types";
import { DEMO_BOOK, DEMO_VIDEO } from "@/lib/demo-data";
import { retrieveRelevantContext } from "@/lib/rag/retriever";
import { streamTutorResponse } from "@/lib/gemini/client";
import { checkRateLimit, validateChatInput } from "@/lib/security/rate-limit";
import { authenticateRequest, verifyBookOwnership, verifyConversationOwnership, isDemoMode } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting: Max 30 chat requests per minute per IP
    const ip = req.headers.get("x-forwarded-for") || "local-client";
    const limitCheck = checkRateLimit(`chat-${ip}`, { limit: 30, windowMs: 60 * 1000 });
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "Too many AI Tutor requests. Please pause before sending another question." },
        { status: 429, headers: { "Retry-After": limitCheck.resetInSec.toString() } }
      );
    }

    const body = await req.json();

    // 2. Validate input constraints
    const validation = validateChatInput(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error || "Invalid request parameters." },
        { status: 400 }
      );
    }

    const {
      question,
      pageNumber = 72,
      selectedText,
      learningMode = "explain",
      videoTimestampSeconds,
      bookId,
      customBook,
      activeVideo,
      conversationId,
    } = body;

    // 3. Authentication & Ownership Verification
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    // If a custom book ID is specified in production, strictly verify ownership
    if (bookId && !bookId.startsWith("demo-")) {
      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required to access this textbook." },
          { status: 401 }
        );
      }

      const isOwner = await verifyBookOwnership(userId, bookId);
      if (!isOwner) {
        return NextResponse.json(
          { error: "Access denied. You do not have permission to query this textbook." },
          { status: 403 }
        );
      }
    }

    // If conversation ID is specified, verify ownership
    if (conversationId && userId) {
      const isConvOwner = await verifyConversationOwnership(userId, conversationId, bookId);
      if (!isConvOwner) {
        return NextResponse.json(
          { error: "Access denied. You do not have permission to access this conversation." },
          { status: 403 }
        );
      }
    }

    // 4. Resolve Target Book Context
    let targetBook: Book = DEMO_BOOK;
    if (customBook && customBook.id) {
      targetBook = customBook;
    } else if (bookId && !bookId.startsWith("demo-") && userId) {
      const supabase = await createServerSupabaseClient();
      if (supabase) {
        const { data: bookRecord } = await supabase
          .from("books")
          .select("*, book_pages(*)")
          .eq("id", bookId)
          .eq("user_id", userId)
          .single();

        if (bookRecord) {
          targetBook = {
            id: bookRecord.id,
            title: bookRecord.title,
            author: bookRecord.author,
            edition: bookRecord.edition,
            subject: bookRecord.subject,
            totalPages: bookRecord.total_pages,
            chapters: [],
            pages: (bookRecord.book_pages || []).map((p: any) => ({
              pageNumber: p.page_number,
              chapterId: p.chapter_id || "ch-1",
              chapterTitle: p.chapter_title || "Chapter",
              sectionId: p.section_id || "sec-1",
              sectionTitle: p.section_title || "Section",
              title: p.title || `Page ${p.page_number}`,
              content: p.content || "",
              keyTakeaways: p.key_takeaways || [],
            })),
            chunks: [],
          };
        }
      }
    }

    const targetVideo: VideoLecture = activeVideo || DEMO_VIDEO;

    // 5. Fail-Closed Hybrid Context Retrieval
    const ragContext = await retrieveRelevantContext(
      question,
      targetBook,
      pageNumber,
      selectedText,
      targetVideo,
      videoTimestampSeconds,
      userId
    );

    // 6. Streaming Response with SSE
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
                // Persist conversation & messages if user is authenticated and not demo book
                if (userId && ragContext.activeBook.id && !ragContext.activeBook.id.startsWith("demo-")) {
                  try {
                    const supabase = await createServerSupabaseClient();
                    if (supabase) {
                      let activeConvId = conversationId;
                      if (!activeConvId) {
                        const { data: conv } = await supabase
                          .from("conversations")
                          .insert({
                            user_id: userId,
                            book_id: ragContext.activeBook.id,
                            title: question.slice(0, 60),
                          })
                          .select("id")
                          .single();
                        if (conv) activeConvId = conv.id;
                      }

                      if (activeConvId) {
                        // Insert User message
                        await supabase.from("messages").insert({
                          conversation_id: activeConvId,
                          sender: "user",
                          content: question,
                          learning_mode: learningMode,
                          context_snapshot: {
                            pageNumber,
                            selectedText: selectedText || null,
                            bookId: ragContext.activeBook.id,
                          },
                        });

                        // Insert AI Assistant message with citations
                        const { data: aiMsg } = await supabase
                          .from("messages")
                          .insert({
                            conversation_id: activeConvId,
                            sender: "ai",
                            content: fullText,
                            learning_mode: learningMode,
                          })
                          .select("id")
                          .single();

                        if (aiMsg && ragContext.citations?.length > 0) {
                          const citationRecords = ragContext.citations.map((c) => ({
                            message_id: aiMsg.id,
                            chunk_id: c.id.startsWith("cite-chunk-") ? c.id.replace("cite-chunk-", "") : null,
                            book_title: c.bookTitle,
                            chapter_title: c.chapter,
                            section_title: c.section,
                            page_number: c.pageNumber,
                            excerpt: c.excerpt,
                          }));
                          await supabase.from("message_citations").insert(citationRecords);
                        }
                      }
                    }
                  } catch (dbErr) {
                    console.warn("Message persistence note:", dbErr);
                  }
                }

                const payload = JSON.stringify({
                  type: "done",
                  fullText,
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
