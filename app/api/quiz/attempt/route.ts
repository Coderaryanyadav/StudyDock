import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required to record quiz attempts." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      quizId,
      bookId,
      score = 0,
      totalQuestions = 1,
      concept = "Core Concept",
      chapterTitle,
      pageNumber = 1,
    } = body;

    const supabase = (await createServerSupabaseClient()) || createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database unavailable." }, { status: 500 });
    }

    // 1. Ensure Quiz record exists if quizId was not provided or temporary
    let validQuizId = quizId;
    if (!validQuizId || validQuizId.startsWith("temp-") || validQuizId.startsWith("q-")) {
      const { data: newQuiz } = await supabase
        .from("quizzes")
        .insert({
          user_id: userId,
          book_id: bookId || null,
          title: `${concept} Assessment`,
          total_questions: totalQuestions,
        })
        .select("id")
        .single();

      if (newQuiz) {
        validQuizId = newQuiz.id;
      }
    }

    // 2. Insert into quiz_attempts
    if (validQuizId) {
      await supabase.from("quiz_attempts").insert({
        user_id: userId,
        quiz_id: validQuizId,
        score,
        total_questions: totalQuestions,
        completed_at: new Date().toISOString(),
      });
    }

    // 3. Update or create Concept and Student Concept Mastery
    if (concept) {
      // Find or insert concept
      let conceptId: string | null = null;
      const { data: existingConcept } = await supabase
        .from("concepts")
        .select("id")
        .eq("name", concept)
        .single();

      if (existingConcept) {
        conceptId = existingConcept.id;
      } else {
        const { data: newConcept } = await supabase
          .from("concepts")
          .insert({
            name: concept,
            category: chapterTitle || "Academic Studies",
          })
          .select("id")
          .single();

        if (newConcept) {
          conceptId = newConcept.id;
        }
      }

      if (conceptId) {
        // Fetch existing student_concept record
        const { data: existingStudentConcept } = await supabase
          .from("student_concepts")
          .select("*")
          .eq("user_id", userId)
          .eq("concept_id", conceptId)
          .single();

        const prevAttempted = existingStudentConcept?.questions_attempted || 0;
        const prevCorrect = existingStudentConcept?.questions_correct || 0;

        const updatedAttempted = prevAttempted + totalQuestions;
        const updatedCorrect = prevCorrect + score;
        const calculatedMastery = updatedAttempted > 0
          ? Math.min(100, Math.max(0, Math.round((updatedCorrect / updatedAttempted) * 100)))
          : 50;

        await supabase.from("student_concepts").upsert(
          {
            user_id: userId,
            concept_id: conceptId,
            mastery_percentage: calculatedMastery,
            questions_attempted: updatedAttempted,
            questions_correct: updatedCorrect,
            is_weak: calculatedMastery < 60,
            recommended_chapter: chapterTitle || `Chapter Review`,
            recommended_page: pageNumber || 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,concept_id" }
        );
      }
    }

    // 4. Update Study Session Activity
    await supabase.from("study_sessions").insert({
      user_id: userId,
      book_id: bookId || null,
      duration_minutes: 2,
      pages_read: 1,
      questions_asked: 0,
    });

    return NextResponse.json({
      success: true,
      score,
      totalQuestions,
      concept,
    });
  } catch (error: any) {
    console.error("Quiz attempt API error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to record quiz attempt." },
      { status: 500 }
    );
  }
}
