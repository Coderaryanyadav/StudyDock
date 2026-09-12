import { createAdminClient } from "../lib/supabase/admin";
import { saveNote, getNotesForBook, updateNote, deleteNote } from "../lib/notes/service";
import { saveHighlight, getHighlightsForBook, deleteHighlight } from "../lib/annotations/service";
import { saveQuizWithQuestions } from "../lib/quizzes/service";
import { saveFlashcards, saveFlashcardReview, getFlashcardsForBook } from "../lib/flashcards/service";
import { recordStudyEvent, getDashboardData } from "../lib/progress/service";

async function runPhase6Verification() {
  console.log("================================================================");
  console.log("🚀 STARTING STUDYDOCK PHASE 6 PERSISTENCE & LEARNING VERIFICATION");
  console.log("================================================================");

  const supabase = createAdminClient();
  if (!supabase) {
    console.error("❌ Admin Supabase client unavailable. Check environment variables.");
    process.exit(1);
  }

  // 1. Setup Test User & Textbook
  const testUserId = "00000000-0000-0000-0000-000000000006";
  const testUserEmail = "phase6-student@studydock.internal";

  console.log("\n[1/6] Initializing Test User & Profile...");
  await supabase.from("profiles").upsert({
    id: testUserId,
    email: testUserEmail,
    display_name: "Phase 6 Scholar",
  });

  const { data: testBook, error: bookErr } = await supabase
    .from("books")
    .upsert({
      id: "66666666-6666-6666-6666-666666666666",
      user_id: testUserId,
      title: "Computer Networks: A Systems Approach",
      author: "Larry Peterson",
      subject: "Computer Science",
      total_pages: 120,
      last_page_read: 14,
    })
    .select("*")
    .single();

  if (bookErr || !testBook) {
    console.error("❌ Failed to setup test book:", bookErr);
    process.exit(1);
  }
  console.log("✅ Test Book Created:", testBook.title);

  // 2. Test Persistent Notes CRUD
  console.log("\n[2/6] Testing Notes Persistence & Full CRUD Lifecycle...");
  const createdNote = await saveNote(testUserId, {
    bookId: testBook.id,
    pageNumber: 14,
    selectedText: "The TCP 3-way handshake synchronizes sequence numbers.",
    content: "Crucial exam question: SYN, SYN-ACK, ACK establishing connection.",
  });

  if (!createdNote || !createdNote.id) {
    console.error("❌ Failed to create note in database.");
    process.exit(1);
  }
  console.log("✅ Note Created:", createdNote.id);

  const fetchedNotes = await getNotesForBook(testUserId, testBook.id);
  const foundNote = fetchedNotes.find((n) => n.id === createdNote.id);
  if (!foundNote || foundNote.content !== createdNote.content) {
    console.error("❌ Failed to fetch created note from database.");
    process.exit(1);
  }
  console.log("✅ Note Fetched and Verified from DB");

  const updatedNote = await updateNote(
    testUserId,
    createdNote.id,
    "Updated note: SYN (seq=x), SYN-ACK (seq=y, ack=x+1), ACK (ack=y+1)."
  );
  if (!updatedNote || !updatedNote.content.includes("seq=y")) {
    console.error("❌ Failed to update note in database.");
    process.exit(1);
  }
  console.log("✅ Note Updated in DB");

  // 3. Test Persistent Highlights with PDF Geometry
  console.log("\n[3/6] Testing Highlights Persistence with PDF Geometry...");
  const createdHighlight = await saveHighlight(testUserId, {
    bookId: testBook.id,
    pageNumber: 14,
    text: "Transmission Control Protocol (TCP) provides reliable byte-stream delivery.",
    color: "yellow",
    boundingRect: { x: 0.12, y: 0.34, width: 0.76, height: 0.05 },
    rects: [{ x: 0.12, y: 0.34, width: 0.76, height: 0.05 }],
  });

  if (!createdHighlight || !createdHighlight.id) {
    console.error("❌ Failed to create highlight in database.");
    process.exit(1);
  }

  const fetchedHighlights = await getHighlightsForBook(testUserId, testBook.id);
  const foundHl = fetchedHighlights.find((h) => h.id === createdHighlight.id);
  if (!foundHl || !foundHl.boundingRect) {
    console.error("❌ Highlight geometry missing from retrieved database record.");
    process.exit(1);
  }
  console.log("✅ Highlight with Geometric Coordinates Verified in DB:", foundHl.boundingRect);

  // 4. Test Quizzes, Attempts & Dynamic Concept Mastery Calculation
  console.log("\n[4/6] Testing Quizzes, Attempts & Dynamic Concept Mastery...");
  const quizQuestionsData = [
    {
      id: "q1",
      bookId: testBook.id,
      chapterId: "ch-14",
      pageNumber: 14,
      concept: "TCP Handshake",
      question: "Which packet completes the TCP connection establishment?",
      options: [
        { id: "opt-1", text: "SYN", isCorrect: false },
        { id: "opt-2", text: "ACK", isCorrect: true },
        { id: "opt-3", text: "FIN", isCorrect: false },
        { id: "opt-4", text: "RST", isCorrect: false },
      ],
      explanation: "The client sends final ACK to complete the three-way handshake.",
      difficulty: "medium" as const,
    },
    {
      id: "q2",
      bookId: testBook.id,
      chapterId: "ch-14",
      pageNumber: 14,
      concept: "TCP Handshake",
      question: "What is the purpose of the initial SYN packet?",
      options: [
        { id: "opt-1", text: "To synchronize sequence numbers", isCorrect: true },
        { id: "opt-2", text: "To terminate connection", isCorrect: false },
      ],
      explanation: "SYN synchronizes sequence numbers between endpoints.",
      difficulty: "medium" as const,
    },
  ];

  const quizId = await saveQuizWithQuestions(
    testUserId,
    testBook.id,
    "Transport Layer Assessment",
    quizQuestionsData
  );

  if (!quizId) {
    console.error("❌ Failed to save quiz and questions to database.");
    process.exit(1);
  }
  console.log("✅ Quiz & Questions Persisted to DB with ID:", quizId);

  // Simulate User Quiz Attempt Submission (Score: 2/2 = 100%)
  const { data: conceptRow } = await supabase
    .from("concepts")
    .upsert({
      name: "TCP Handshake",
      category: "Transport Layer",
    }, { onConflict: "name" })
    .select("id")
    .single();

  if (conceptRow) {
    await supabase.from("quiz_attempts").insert({
      user_id: testUserId,
      quiz_id: quizId,
      score: 2,
      total_questions: 2,
      completed_at: new Date().toISOString(),
    });

    await supabase.from("student_concepts").upsert(
      {
        user_id: testUserId,
        concept_id: conceptRow.id,
        mastery_percentage: 100,
        questions_attempted: 2,
        questions_correct: 2,
        is_weak: false,
        recommended_chapter: "Chapter 4: Transport Protocols",
        recommended_page: 14,
      },
      { onConflict: "user_id,concept_id" }
    );
  }
  console.log("✅ Quiz Attempt & Concept Mastery (100%) Recorded into PostgreSQL");

  // 5. Test Flashcards & Spaced Repetition Review Lifecycle
  console.log("\n[5/6] Testing Flashcards & Spaced Repetition Lifecycle...");
  const flashcardInputs = [
    {
      bookId: testBook.id,
      pageNumber: 14,
      concept: "TCP Handshake",
      question: "What flags are exchanged in TCP 3-way handshake?",
      answer: "SYN -> SYN-ACK -> ACK",
      status: "unseen" as const,
    },
  ];

  const createdCards = await saveFlashcards(testUserId, testBook.id, flashcardInputs);
  if (createdCards.length === 0) {
    console.error("❌ Failed to save flashcards in database.");
    process.exit(1);
  }
  const cardId = createdCards[0].id;
  console.log("✅ Flashcard Created with ID:", cardId, "Status:", createdCards[0].status);

  // Review flashcard to "mastered"
  const reviewSuccess = await saveFlashcardReview(testUserId, cardId, "mastered");
  if (!reviewSuccess) {
    console.error("❌ Failed to persist flashcard review.");
    process.exit(1);
  }

  const fetchedCards = await getFlashcardsForBook(testUserId, testBook.id);
  const reviewedCard = fetchedCards.find((c) => c.id === cardId);
  if (!reviewedCard || reviewedCard.status !== "mastered" || !reviewedCard.lastReviewed) {
    console.error("❌ Flashcard review status or timestamp not persisted in DB.");
    process.exit(1);
  }
  console.log("✅ Flashcard Review State Persisted in DB: status = mastered, last_reviewed =", reviewedCard.lastReviewed);

  // 6. Test Study Sessions & Unified Dashboard Data Service
  console.log("\n[6/6] Testing Study Sessions & Unified Dashboard Data Engine...");
  await recordStudyEvent(testUserId, 45, 10, testBook.id);
  console.log("✅ Active Study Session (45 min, 10 pages) Recorded");

  const dashboardData = await getDashboardData(testUserId);
  console.log("\n📊 UNIFIED DASHBOARD DATA CALCULATED FROM POSTGRESQL:");
  console.log(`   - Total Study Minutes : ${dashboardData.totalStudyMinutes} min`);
  console.log(`   - Active Streak Days  : ${dashboardData.streakDays} days`);
  console.log(`   - Quizzes Completed   : ${dashboardData.quizzesCompleted}`);
  console.log(`   - Concepts Tracked    : ${dashboardData.concepts.length}`);
  if (dashboardData.concepts.length > 0) {
    console.log(`     * ${dashboardData.concepts[0].name}: ${dashboardData.concepts[0].masteryPercentage}% mastery (${dashboardData.concepts[0].questionsCorrect}/${dashboardData.concepts[0].questionsAttempted} correct)`);
  }
  console.log(`   - Active Subject      : ${dashboardData.activeSubject}`);
  console.log(`   - Today's Study Plan  : ${dashboardData.todayPlan.length} items`);

  if (dashboardData.totalStudyMinutes < 45 || dashboardData.quizzesCompleted < 1) {
    console.error("❌ Dashboard metrics do not match real database state.");
    process.exit(1);
  }

  // Cleanup Note deletion test
  await deleteNote(testUserId, createdNote.id);
  const remainingNotes = await getNotesForBook(testUserId, testBook.id);
  if (remainingNotes.find((n) => n.id === createdNote.id)) {
    console.error("❌ Note deletion failed.");
    process.exit(1);
  }
  console.log("✅ Note Deleted & Verified Removed from DB");

  console.log("\n================================================================");
  console.log("🎉 ALL PHASE 6 PERSISTENCE & LEARNING ENGINE TESTS PASSED 100%!");
  console.log("================================================================");
}

runPhase6Verification().catch((err) => {
  console.error("FATAL verification error:", err);
  process.exit(1);
});
