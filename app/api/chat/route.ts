import { NextRequest, NextResponse } from "next/server";
import { LearningMode, Book, VideoLecture } from "@/types";
import { DEMO_BOOK, DEMO_VIDEO } from "@/lib/demo-data";
import { retrieveRelevantContext } from "@/lib/rag/retriever";
import { streamTutorResponse } from "@/lib/gemini/client";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest } from "@/lib/supabase/auth";
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

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json(
        { error: "A valid question string is required." },
        { status: 400 }
      );
    }

    // 2. Authentication check
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    // 3. Resolve Target Book Context
    let targetBook: Book = DEMO_BOOK;
    if (customBook && customBook.id) {
      targetBook = customBook;
    } else if (bookId && bookId !== "demo-cn-topdown") {
      const supabase = await createServerSupabaseClient();
      if (supabase && userId) {
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

    // 4. Hybrid Context Retrieval (pgvector + keyword + page/selection boost)
    const ragContext = await retrieveRelevantContext(
      question,
      targetBook,
      pageNumber,
      selectedText,
      targetVideo,
      videoTimestampSeconds
    );

    // 5. Streaming Response with SSE
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
                // Persist conversation & messages if authenticated
                if (userId && ragContext.activeBook.id) {
                  try {
                    const supabase = await createServerSupabaseClient();
                    if (supabase) {
                      let activeConvId = conversationId;
                      if (!activeConvId) {
                        const { data: conv } = await supabase
                          .from("conversations")
                          .insert({
                            user_id: userId,
                            book_id: ragContext.activeBook.id.startsWith("demo-") ? null : ragContext.activeBook.id,
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
                          user_id: userId,
                          role: "user",
                          content: question,
                          page_number: pageNumber,
                          selected_text: selectedText || null,
                          learning_mode: learningMode,
                        });

                        // Insert Assistant message with citations
                        await supabase.from("messages").insert({
                          conversation_id: activeConvId,
                          user_id: userId,
                          role: "assistant",
                          content: fullText,
                          page_number: pageNumber,
                          citations: ragContext.citations,
                          learning_mode: learningMode,
                        });
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
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
