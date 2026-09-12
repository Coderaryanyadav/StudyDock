import { NextRequest, NextResponse } from "next/server";
import { LearningMode } from "@/types";
import { DEMO_BOOK, DEMO_VIDEO } from "@/lib/demo-data";
import { buildRagContext } from "@/lib/rag/engine";
import { streamTutorResponse } from "@/lib/gemini/client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      question,
      pageNumber = 72,
      selectedText,
      learningMode = "explain",
      videoTimestampSeconds,
      bookId,
    } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    // Build RAG context with active book and video
    const activeBook = DEMO_BOOK; // In production this fetches from database by bookId
    const activeVideo = DEMO_VIDEO;

    const ragContext = buildRagContext(
      question,
      activeBook,
      pageNumber,
      selectedText,
      activeVideo,
      videoTimestampSeconds
    );

    // Create a ReadableStream for true SSE / streaming chunk delivery
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
              onComplete: (fullText) => {
                const payload = JSON.stringify({
                  type: "done",
                  fullText,
                  citations: ragContext.citations,
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
                  error: err.message,
                });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                controller.close();
              },
            }
          );
        } catch (streamError: any) {
          const payload = JSON.stringify({
            type: "error",
            error: streamError?.message || "Streaming error",
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
      { error: "Internal Server Error", details: error?.message },
      { status: 500 }
    );
  }
}
