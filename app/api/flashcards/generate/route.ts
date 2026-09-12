import { NextRequest, NextResponse } from "next/server";
import { DEMO_FLASHCARDS } from "@/lib/demo-data";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pageNumber, concept } = body;

    let flashcards = DEMO_FLASHCARDS;
    if (pageNumber) {
      const filtered = DEMO_FLASHCARDS.filter((f) => f.pageNumber === pageNumber);
      if (filtered.length > 0) {
        flashcards = filtered;
      }
    }

    return NextResponse.json({
      success: true,
      flashcards,
      count: flashcards.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to generate flashcards", details: error?.message },
      { status: 500 }
    );
  }
}
