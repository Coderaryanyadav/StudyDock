import { NextRequest, NextResponse } from "next/server";
import { DEMO_QUIZ_QUESTIONS } from "@/lib/demo-data";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pageNumber, concept } = body;

    // Filter or generate quiz questions for the target page / concept
    let questions = DEMO_QUIZ_QUESTIONS;
    if (pageNumber) {
      const pageMatch = DEMO_QUIZ_QUESTIONS.filter((q) => q.pageNumber === pageNumber);
      if (pageMatch.length > 0) {
        questions = pageMatch;
      }
    }

    return NextResponse.json({
      success: true,
      questions,
      count: questions.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to generate quiz", details: error?.message },
      { status: 500 }
    );
  }
}
