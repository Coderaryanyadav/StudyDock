import { NextRequest, NextResponse } from "next/server";
import { LearningMode, Book, VideoLecture } from "@/types";
import { retrieveRelevantContext } from "@/lib/rag/retriever";
import { streamTutorResponse } from "@/lib/gemini/client";
import { checkRateLimit, validateChatInput } from "@/lib/security/rate-limit";
import { authenticateRequest, verifyBookOwnership, verifyConversationOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
      pageNumber = 1,
      selectedText,
      learningMode = "explain",
      videoTimestampSeconds,
      bookId,
      conversationId,
    } = body;

    // 3. Authentication & Ownership Verification
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required to query the AI Tutor." },
        { status: 401 }
      );
    }

    if (!bookId) {
      return NextResponse.json(
        { error: "Book ID is required." },
        { status: 400 }
      );
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
    if (conversationId) {
      const isConvOwner = await verifyConversationOwnership(userId, conversationId, bookId);
      if (!isConvOwner) {
        return NextResponse.json(
          { error: "Access denied. You do not have permission to access this conversation." },
          { status: 403 }
        );
      }
    }

    // 4. Resolve Target Book Context Authoritatively from Database
    let targetBook: Book | null = null;
    let targetVideo: VideoLecture | undefined = undefined;

    const supabase = await createServerSupabaseClient() || createAdminClient();
    if (supabase) {
      const { data: bookRecord, error: bookErr } = await supabase
        .from("books")
        .select("*, book_pages(*)")
        .eq("id", bookId)
        .eq("user_id", userId)
        .single();

      if (bookErr || !bookRecord) {
        return NextResponse.json(
          { error: "Target book could not be found or you do not have permission to access it." },
          { status: 404 }
        );
      }

      targetBook = {
        id: bookRecord.id,
        title: bookRecord.title,
        author: bookRecord.author,
        edition: bookRecord.edition,
        subject: bookRecord.subject,
        totalPages: bookRecord.total_pages || (bookRecord.book_pages || []).length,
        chapters: [],
        pages: (bookRecord.book_pages || []).map((p: any) => ({
          pageNumber: p.page_number,
          chapterId: p.chapter_id || null,
          chapterTitle: p.chapter_title || null,
          sectionId: p.section_id || null,
          sectionTitle: p.section_title || null,
          title: p.title || `Page ${p.page_number}`,
          content: p.content || "",
          keyTakeaways: p.key_takeaways || [],
        })),
        chunks: [],
      };

      if (bookRecord.youtube_url) {
        const match = bookRecord.youtube_url.match(
          /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
        );
        if (match) {
          targetVideo = {
            id: `vid-${match[1]}`,
            youtubeId: match[1],
            title: bookRecord.video_title || `Lecture (${match[1]})`,
            channelName: bookRecord.video_channel || null,
            durationSeconds: 0,
            formattedDuration: "00:00",
            bookId: bookRecord.id,
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
