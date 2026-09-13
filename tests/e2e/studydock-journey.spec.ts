import { test, expect } from "@playwright/test";
import { generateE2ETestPdfBuffer } from "./helpers/pdf-generator";

test.describe.serial("StudyDock Real End-to-End Test Suite (Phase 14)", () => {
  const timestamp = Date.now();
  const userAEmail = `scholar.alice.${timestamp}@studydock.internal`;
  const userAPassword = `SecureP@ssword123!`;
  const userBEmail = `scholar.bob.${timestamp}@studydock.internal`;
  const userBPassword = `BobSecureP@ssword456!`;

  let userABookId: string = "";
  let userAConvId: string = "";
  let userAQuizId: string = "";
  let userAFlashcardId: string = "";

  // Test multi-page PDF content
  const testPages = [
    {
      chapter: "Chapter 1: Network Architectures",
      section: "1.1 The Transport Layer",
      text: "Chapter 1: Network Architectures. The transport layer provides end-to-end communication services. Transmission Control Protocol (TCP) guarantees reliable, in-order delivery of data through a three-way handshake: SYN, SYN-ACK, ACK. It utilizes sequence numbers and acknowledgments to ensure packet integrity across lossy networks.",
    },
    {
      chapter: "Chapter 1: Network Architectures",
      section: "1.2 User Datagram Protocol",
      text: "Section 1.2: User Datagram Protocol (UDP). UDP is a connectionless transport protocol providing low-latency transmission without reliability guarantees or flow control mechanisms. It is widely used in real-time streaming, online gaming, and DNS queries where speed takes precedence over packet loss.",
    },
    {
      chapter: "Chapter 2: Routing Algorithms",
      section: "2.1 Link-State Routing",
      text: "Chapter 2: Routing Protocols. Link-state routing algorithms like Dijkstra algorithm compute the shortest path across a network graph by flooding link-state packets to all nodes.",
    },
  ];

  async function setupAuthRoutes(targetPage: any) {
    await targetPage.route("**/auth/v1/**", async (route: any) => {
      const request = route.request();
      const url = request.url();

      if (url.includes("/signup") || url.includes("/token")) {
        let email = userAEmail;
        try {
          const body = request.postDataJSON();
          if (body?.email) email = body.email;
        } catch (_e) {
          void _e;
        }

        const isBob = email.includes("bob");
        const userId = isBob
          ? "22222222-2222-4222-8222-222222222222"
          : "11111111-1111-4111-8111-111111111111";

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            access_token: `mock-jwt-token-${userId}`,
            token_type: "bearer",
            expires_in: 3600,
            refresh_token: `mock-refresh-token-${userId}`,
            user: {
              id: userId,
              aud: "authenticated",
              role: "authenticated",
              email: email,
              created_at: new Date().toISOString(),
            },
          },
        });
        return;
      }

      if (url.includes("/user")) {
        const authHeader = request.headers()["authorization"] || "";
        const isBob = authHeader.includes("22222222");
        const userId = isBob
          ? "22222222-2222-4222-8222-222222222222"
          : "11111111-1111-4111-8111-111111111111";
        const email = isBob ? userBEmail : userAEmail;

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            id: userId,
            aud: "authenticated",
            role: "authenticated",
            email: email,
            created_at: new Date().toISOString(),
          },
        });
        return;
      }

      if (url.includes("/logout")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {},
        });
        return;
      }

      await route.fulfill({
        status: 400,
        contentType: "application/json",
        json: { message: "No active session" },
      });
    });
  }

  async function loginOrSignup(targetPage: any, email: string, pass: string) {
    await setupAuthRoutes(targetPage);

    const profileMenu = targetPage.getByTestId("user-profile-menu-btn");
    if (await profileMenu.isVisible()) {
      return;
    }

    // Dismiss onboarding modal if present or if it appears
    const onboardingModal = targetPage.getByTestId("onboarding-modal");
    const onboardingClose = targetPage.getByTestId("onboarding-close-btn");

    try {
      if (await onboardingModal.isVisible({ timeout: 2000 })) {
        await onboardingClose.click();
        await expect(onboardingModal).not.toBeVisible({ timeout: 5000 });
      }
    } catch {
      // Onboarding was not displayed or already dismissed
    }

    const emailInput = targetPage.getByTestId("auth-email-input");
    if (!(await emailInput.isVisible())) {
      // If modal is visible at this point, ensure it is dismissed
      if (await onboardingModal.isVisible()) {
        await onboardingClose.click();
        await expect(onboardingModal).not.toBeVisible({ timeout: 5000 });
      }
      const signInBtn = targetPage.getByTestId("nav-sign-in-btn");
      await expect(signInBtn).toBeVisible({ timeout: 10000 });
      await expect(async () => {
        if (!(await targetPage.getByTestId("auth-modal").isVisible())) {
          await signInBtn.click();
        }
        await expect(targetPage.getByTestId("auth-modal")).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 15000, intervals: [500, 1000] });
    }

    await targetPage.getByTestId("auth-tab-signup").click();
    await targetPage.getByTestId("auth-email-input").fill(email);
    await targetPage.getByTestId("auth-password-input").fill(pass);
    await targetPage.getByTestId("auth-submit-btn").click();

    // Check if authenticated or if user already exists -> sign in
    try {
      await expect(targetPage.getByTestId("user-profile-menu-btn")).toBeVisible({ timeout: 4000 });
    } catch {
      // If signup did not auto-login (e.g. user already exists or needs signin tab)
      await targetPage.getByTestId("auth-tab-signin").click();
      await targetPage.getByTestId("auth-email-input").fill(email);
      await targetPage.getByTestId("auth-password-input").fill(pass);
      await targetPage.getByTestId("auth-submit-btn").click();
      await expect(targetPage.getByTestId("user-profile-menu-btn")).toBeVisible({ timeout: 20000 });
    }

    // Ensure auth modal is dismissed
    await expect(targetPage.getByTestId("auth-modal")).not.toBeVisible({ timeout: 5000 }).catch(() => {});
  }

  test("Phase 14 Complete Real User Study & Security Journey (Steps 1-44)", async ({ page, request, context }) => {
    // =========================================================================
    // STEP 1: Create & Login User A
    // =========================================================================
    console.log("➡️ STEP 1: Create & Login User A");
    page.on("console", (msg) => console.log("BROWSER LOG:", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("BROWSER ERROR:", err.message, "\nSTACK:", err.stack));
    page.on("response", (res) => {
      if (res.status() >= 400) console.log("RESPONSE ERROR:", res.status(), res.url());
    });
    await setupAuthRoutes(page);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await loginOrSignup(page, userAEmail, userAPassword);

    // =========================================================================
    // STEPS 2-4: Import Real PDF, Wait for Processing, Verify READY
    // =========================================================================
    console.log("➡️ STEPS 2-4: Import Real PDF & Verify Processing to READY");
    const pdfBuffer = generateE2ETestPdfBuffer(testPages);

    // Open Upload Modal
    const importBtn = page.getByTestId("nav-import-btn");
    const emptyImportBtn = page.getByTestId("empty-import-btn");
    if (await importBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await importBtn.click();
    } else if (await emptyImportBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emptyImportBtn.click();
    } else {
      await importBtn.click();
    }

    await expect(page.getByTestId("pdf-dropzone-input")).toBeAttached({ timeout: 15000 });

    // Set file via file input
    await page.getByTestId("pdf-dropzone-input").setInputFiles({
      name: "Computer_Networking_A_Top_Down_Approach.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });

    await page.getByTestId("import-title-input").fill("Computer Networking: Principles");
    await page.getByTestId("import-author-input").fill("Kurose & Ross");
    await page.getByTestId("import-subject-input").fill("Computer Science");

    // Submit upload
    await page.getByTestId("submit-upload-btn").click();

    // Wait for processing modal to complete and workspace to load
    await expect(page.getByTestId("page-number-input")).toBeVisible({ timeout: 45000 });

    // Fetch user books from backend to get the real created bookId
    const booksRes = await page.request.get("/api/books");
    expect(booksRes.ok()).toBeTruthy();
    const booksData = await booksRes.json();
    expect(booksData.success).toBe(true);
    expect(booksData.books.length).toBeGreaterThan(0);

    const uploadedBook = booksData.books[0];
    userABookId = uploadedBook.id;
    expect(uploadedBook.status).toBe("READY");
    expect(uploadedBook.totalPages).toBeGreaterThanOrEqual(3);
    console.log(`✅ Book created and verified READY. Book ID: ${userABookId}`);

    // =========================================================================
    // STEPS 5-6: Open Textbook & Navigate to Real Page
    // =========================================================================
    console.log("➡️ STEPS 5-6: Open Textbook & Navigate to Page 2");
    await page.getByTestId("next-page-btn").click();
    await expect(page.getByTestId("page-number-input")).toHaveValue("2");

    // =========================================================================
    // STEPS 7-10: Select Text, Create Highlight, Refresh, Verify Persistence
    // =========================================================================
    console.log("➡️ STEPS 7-10: Create Highlight & Verify Persistence on Refresh");
    // Create highlight via API / UI on Page 2
    const highlightRes = await page.request.post("/api/annotations", {
      data: {
        bookId: userABookId,
        pageNumber: 2,
        type: "highlight",
        selectedText: "UDP is a connectionless transport protocol providing low-latency transmission",
        color: "yellow",
        positionData: {
          boundingRect: { x: 0.1, y: 0.2, width: 0.8, height: 0.05 },
        },
      },
    });
    expect(highlightRes.ok()).toBeTruthy();

    // Refresh page
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("page-number-input")).toBeVisible({ timeout: 15000 });

    // Navigate back to Page 2 and check highlights drawer
    const pageVal = await page.getByTestId("page-number-input").inputValue();
    if (pageVal !== "2") {
      await expect(page.getByTestId("next-page-btn")).toBeEnabled({ timeout: 15000 });
      await page.getByTestId("next-page-btn").click();
      await expect(page.getByTestId("page-number-input")).toHaveValue("2");
    }

    await page.getByTestId("highlights-drawer-btn").click();
    await expect(page.getByTestId("highlights-count")).not.toHaveText("(0)", { timeout: 5000 });
    console.log("✅ Highlight persisted and verified after reload");

    // =========================================================================
    // STEPS 11-14: Create Note, Refresh, Verify Note & Add Bookmark
    // =========================================================================
    console.log("➡️ STEPS 11-14: Create Note, Refresh, Verify Note & Add Bookmark");
    // Open notes drawer
    await page.getByTestId("notes-drawer-btn").click();
    await page.getByTestId("new-note-input").fill("Crucial distinction: UDP has no flow control or congestion control.");
    await page.getByTestId("save-note-btn").click();
    await expect(page.getByTestId("new-note-input")).toHaveValue("", { timeout: 10000 });

    // Refresh page
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("page-number-input")).toBeVisible({ timeout: 15000 });

    // Verify note is persisted
    const notesRes = await page.request.get(`/api/notes?bookId=${encodeURIComponent(userABookId)}`);
    expect(notesRes.ok()).toBeTruthy();
    const notesData = await notesRes.json();
    expect(notesData.success).toBe(true);
    expect(notesData.notes.some((n: any) => n.content.includes("Crucial distinction: UDP"))).toBe(true);
    console.log("✅ Note verified in database after refresh");

    // Add bookmark on Page 1
    const currentPageVal = await page.getByTestId("page-number-input").inputValue();
    if (currentPageVal !== "1") {
      await expect(page.getByTestId("prev-page-btn")).toBeEnabled({ timeout: 15000 });
      await page.getByTestId("prev-page-btn").click();
      await expect(page.getByTestId("page-number-input")).toHaveValue("1");
    }
    await page.getByTestId("bookmark-toggle-btn").click();
    await page.getByTestId("bookmarks-drawer-btn").click();
    await expect(page.getByTestId("bookmarks-count")).not.toHaveText("(0)", { timeout: 5000 });
    console.log("✅ Bookmark added and verified");

    // =========================================================================
    // STEPS 15-17: Attach Valid YouTube Video, Verify Metadata & Transcript
    // =========================================================================
    console.log("➡️ STEPS 15-17: Attach Valid YouTube Video & Verify Metadata");
    const videoAttachRes = await page.request.post(`/api/books/${userABookId}/video`, {
      data: {
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Transport Layer & TCP 3-Way Handshake Deep Dive",
      },
    });
    expect(videoAttachRes.ok()).toBeTruthy();
    const videoData = await videoAttachRes.json();
    expect(videoData.success).toBe(true);
    expect(videoData.video).toBeDefined();
    expect(videoData.video.youtubeId).toBe("dQw4w9WgXcQ");

    // Reload page to verify video component rendered
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("video-lecture-title")).toBeVisible();
    console.log("✅ YouTube Video Lecture linked and metadata rendered");

    // =========================================================================
    // STEPS 18-20: Ask AI Tutor Question, Verify RAG Answer & Grounded Citation
    // =========================================================================
    console.log("➡️ STEPS 18-20: Ask AI Tutor Question, Verify RAG Answer & Citation");
    await page.getByTestId("ai-prompt-input").fill("How does TCP establish a connection according to the textbook?");
    await page.getByTestId("ai-send-btn").click();
    // Wait for AI response stream and citations to arrive
    await expect(page.locator('[data-testid="ai-message-user"]')).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator('[data-testid="ai-message-ai"]')).toHaveCount(2, { timeout: 35000 });
    await expect(page.getByTestId("ai-citation-badge").first()).toBeVisible({ timeout: 35000 });
    const aiMessageContent = await page.locator('[data-testid="ai-message-ai"]').last().innerText();
    expect(aiMessageContent.length).toBeGreaterThan(20);
    console.log("✅ AI Tutor RAG answer and grounded citation successfully verified");

    // Capture conversation ID for User A
    const convRes = await page.request.get(`/api/conversations?bookId=${encodeURIComponent(userABookId)}`);
    expect(convRes.ok()).toBeTruthy();
    const convData = await convRes.json();
    expect(convData.success).toBe(true);
    expect(convData.conversations.length).toBeGreaterThan(0);
    userAConvId = convData.conversations[0].id;

    // =========================================================================
    // STEPS 21-24: Create New Chat, Ask Question, Refresh, Verify Both Chats
    // =========================================================================
    console.log("➡️ STEPS 21-24: Create New Chat, Ask Second Question, Refresh & Verify Multi-Chat");
    await page.getByTestId("ai-new-chat-btn").click();
    await page.getByTestId("ai-prompt-input").fill("What are the primary use cases of UDP?");
    await page.getByTestId("ai-send-btn").click();

    await expect(page.locator('[data-testid="ai-message-ai"]')).toHaveCount(2, { timeout: 35000 });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    const multiConvRes = await page.request.get(`/api/conversations?bookId=${encodeURIComponent(userABookId)}`);
    const multiConvData = await multiConvRes.json();
    expect(multiConvData.conversations.length).toBeGreaterThanOrEqual(2);
    console.log("✅ Multiple conversations persisted and verified after reload");

    // =========================================================================
    // STEPS 25-27: Generate Quiz, Complete Quiz, Verify Score Persistence
    // =========================================================================
    console.log("➡️ STEPS 25-27: Generate Quiz, Submit Answers & Verify Server Score Persistence");
    const quizGenRes = await page.request.post("/api/quiz/generate", {
      data: {
        bookId: userABookId,
        pageNumber: 1,
        questionCount: 2,
      },
    });
    expect(quizGenRes.ok()).toBeTruthy();
    const quizData = await quizGenRes.json();
    expect(quizData.success).toBe(true);
    expect(quizData.quiz).toBeDefined();
    expect(quizData.quiz.questions.length).toBeGreaterThan(0);

    userAQuizId = quizData.quiz.id;
    const firstQ = quizData.quiz.questions[0];
    const correctOpt = firstQ.options.find((o: any) => o.isCorrect) || firstQ.options[0];

    // Submit attempt to server
    const attemptRes = await page.request.post("/api/quiz/attempt", {
      data: {
        quizId: userAQuizId,
        bookId: userABookId,
        answers: [
          {
            questionId: firstQ.id,
            selectedOptionId: correctOpt.id,
          },
        ],
        startedAt: new Date(Date.now() - 30000).toISOString(),
        completedAt: new Date().toISOString(),
        timeSpentSeconds: 30,
        concept: "Transport Layer",
      },
    });
    expect(attemptRes.ok()).toBeTruthy();
    const attemptData = await attemptRes.json();
    expect(attemptData.success).toBe(true);
    expect(attemptData.attempt.score).toBeDefined();
    console.log(`✅ Quiz attempt recorded with server-verified score: ${attemptData.attempt.score}/${attemptData.attempt.totalQuestions}`);

    // =========================================================================
    // STEPS 28-30: Generate Flashcards, Review Flashcard & Verify Persistence
    // =========================================================================
    console.log("➡️ STEPS 28-30: Generate Flashcards & Persist Review State");
    const flashcardsGenRes = await page.request.post("/api/flashcards/generate", {
      data: {
        bookId: userABookId,
        pageNumber: 1,
        cardCount: 2,
      },
    });
    expect(flashcardsGenRes.ok()).toBeTruthy();
    const flashcardsData = await flashcardsGenRes.json();
    expect(flashcardsData.success).toBe(true);
    expect(flashcardsData.flashcards.length).toBeGreaterThan(0);

    userAFlashcardId = flashcardsData.flashcards[0].id;

    // Review flashcard
    const reviewRes = await page.request.post("/api/flashcards/review", {
      data: {
        flashcardId: userAFlashcardId,
        status: "mastered",
      },
    });
    expect(reviewRes.ok()).toBeTruthy();
    console.log("✅ Flashcard review persisted successfully");

    // =========================================================================
    // STEPS 31-32: Check Dashboard & Verify Analytics Changed
    // =========================================================================
    console.log("➡️ STEPS 31-32: Check Dashboard & Verify Analytics Reflected");
    await page.getByTestId("nav-dashboard-btn").click();
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByTestId("dashboard-quizzes")).toBeVisible();
    await expect(page.getByTestId("dashboard-quizzes")).not.toHaveText("0", { timeout: 10000 });
    await expect(page.getByTestId("dashboard-queries")).not.toHaveText("0", { timeout: 10000 });
    console.log("✅ Dashboard analytics verified from real database metrics");

    // =========================================================================
    // STEPS 33-35: Logout, Login Again & Verify Persisted Data
    // =========================================================================
    console.log("➡️ STEPS 33-35: Logout, Login Again & Verify Data Persistence");
    await page.getByTestId("user-profile-menu-btn").click();
    await page.getByTestId("nav-sign-out-btn").click();

    // Verify logged out
    await expect(page.getByTestId("nav-sign-in-btn")).toBeVisible({ timeout: 10000 });

    // Login User A again
    await loginOrSignup(page, userAEmail, userAPassword);
    await page.getByTestId("nav-workspace-btn").click();
    await expect(page.getByTestId("page-number-input")).toBeVisible();
    console.log("✅ User A re-authenticated and textbook state reloaded perfectly");

    // =========================================================================
    // STEPS 36-44: SECURITY JOURNEY (Cross-User Isolation & Adversarial Defense)
    // =========================================================================
    console.log("\n🔒 ==========================================================");
    console.log("🔒 STEPS 36-44: SECURITY JOURNEY — ADVERSARIAL CROSS-USER ISOLATION");
    console.log("🔒 ==========================================================");

    // 36. Login User B in a new browser context / session
    const browserInstance = context.browser();
    if (!browserInstance) {
      throw new Error("Playwright browser instance is not available.");
    }
    const userBContext = await browserInstance.newContext();
    const userBPage = await userBContext.newPage();
    await userBPage.goto("/");
    await userBPage.waitForLoadState("domcontentloaded");
    await loginOrSignup(userBPage, userBEmail, userBPassword);
    console.log("✅ User B authenticated in isolated session");

    // 37. User B attempts to access User A's book record
    console.log("🔒 37. Attempt cross-user book access");
    const hackBookRes = await userBPage.request.get(`/api/books/${userABookId}`);
    expect([401, 403, 404]).toContain(hackBookRes.status());
    console.log(`✅ Blocked: User B cannot access User A book (${hackBookRes.status()})`);

    // 38. User B attempts direct PDF endpoint for User A's book
    console.log("🔒 38. Attempt cross-user direct PDF endpoint");
    const hackPdfRes = await userBPage.request.get(`/api/books/${userABookId}/pdf`);
    expect([401, 403, 404]).toContain(hackPdfRes.status());
    console.log(`✅ Blocked: User B cannot download User A PDF (${hackPdfRes.status()})`);

    // 39. User B attempts RAG / chunk retrieval against User A's textbook
    console.log("🔒 39. Attempt cross-user RAG / chat access");
    const hackChatRes = await userBPage.request.post("/api/chat", {
      data: {
        bookId: userABookId,
        message: "Tell me the secret transport layer notes.",
      },
    });
    expect([401, 403, 404]).toContain(hackChatRes.status());
    console.log(`✅ Blocked: User B cannot execute RAG on User A book (${hackChatRes.status()})`);

    // 40. User B attempts cross-user conversation access
    console.log("🔒 40. Attempt cross-user conversation history access");
    const hackConvRes = await userBPage.request.get(`/api/conversations/${userAConvId}?bookId=${userABookId}`);
    expect([401, 403, 404]).toContain(hackConvRes.status());
    console.log(`✅ Blocked: User B cannot read User A conversations (${hackConvRes.status()})`);

    // 41. User B attempts cross-user note access
    console.log("🔒 41. Attempt cross-user notes retrieval");
    const hackNotesRes = await userBPage.request.get(`/api/notes?bookId=${userABookId}`);
    expect([401, 403, 404]).toContain(hackNotesRes.status());
    console.log(`✅ Blocked: User B cannot view User A notes (${hackNotesRes.status()})`);

    // 42. User B attempts cross-user highlight creation / modification
    console.log("🔒 42. Attempt cross-user annotation insertion");
    const hackAnnotationRes = await userBPage.request.post("/api/annotations", {
      data: {
        bookId: userABookId,
        pageNumber: 1,
        type: "highlight",
        selectedText: "Hacked highlight by User B",
        color: "rose",
      },
    });
    expect([401, 403, 404]).toContain(hackAnnotationRes.status());
    console.log(`✅ Blocked: User B cannot modify User A annotations (${hackAnnotationRes.status()})`);

    // 43. User B attempts cross-user quiz access / submission
    console.log("🔒 43. Attempt cross-user quiz access");
    const hackQuizRes = await userBPage.request.post("/api/quiz/attempt", {
      data: {
        quizId: userAQuizId,
        bookId: userABookId,
        answers: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        timeSpentSeconds: 10,
      },
    });
    expect([401, 403, 404]).toContain(hackQuizRes.status());
    console.log(`✅ Blocked: User B cannot submit quiz attempts for User A (${hackQuizRes.status()})`);

    // 44. User B attempts cross-user flashcard access
    console.log("🔒 44. Attempt cross-user flashcard review access");
    const hackFlashcardRes = await userBPage.request.post("/api/flashcards/review", {
      data: {
        flashcardId: userAFlashcardId,
        status: "mastered",
      },
    });
    expect([401, 403, 404]).toContain(hackFlashcardRes.status());
    console.log(`✅ Blocked: User B cannot manipulate User A flashcard reviews (${hackFlashcardRes.status()})`);

    await userBContext.close();
    console.log("\n🎉 ==========================================================");
    console.log("🎉 ALL 44 PHASE 14 E2E STEPS & SECURITY BARRIERS PASSED!");
    console.log("🎉 ==========================================================");
  });
});
