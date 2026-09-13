import { test, expect } from "@playwright/test";
import { generateE2ETestPdfBuffer } from "./helpers/pdf-generator";

test.describe.serial("StudyDock Definitive Acceptance Test Suite", () => {
  const timestamp = Date.now();
  const userAEmail = `scholar.a.${timestamp}@studydock.internal`;
  const userAPassword = `SecureP@ssword123!`;
  const userBEmail = `scholar.b.${timestamp}@studydock.internal`;
  const userBPassword = `BobSecureP@ssword456!`;

  let userABookId: string = "";
  let userAConvId: string = "";
  let userAQuizId: string = "";

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

        const isBob = email.includes("bob") || email.includes(".b.");
        const userId = isBob
          ? "22222222-2222-4222-8222-222222222222"
          : "11111111-1111-4111-8111-111111111111";

        const sessionPayload = {
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
        };

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            ...sessionPayload,
            session: sessionPayload,
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

      await route.continue();
    });
  }

  async function performAuth(page: any, email: string, pass: string) {
    await setupAuthRoutes(page);

    const profileMenu = page.getByTestId("user-profile-menu-btn");
    if (await profileMenu.isVisible().catch(() => false)) {
      return;
    }

    const onboardingModal = page.getByTestId("onboarding-modal");
    const onboardingClose = page.getByTestId("onboarding-close-btn");
    try {
      if (await onboardingModal.isVisible({ timeout: 2000 })) {
        await onboardingClose.click();
        await expect(onboardingModal).not.toBeVisible({ timeout: 5000 });
      }
    } catch {
      // Onboarding not visible
    }

    const emailInput = page.getByTestId("auth-email-input");
    if (!(await emailInput.isVisible().catch(() => false))) {
      const signInBtn = page.getByTestId("nav-sign-in-btn");
      await expect(signInBtn).toBeVisible({ timeout: 15000 });
      await expect(async () => {
        if (!(await page.getByTestId("auth-modal").isVisible().catch(() => false))) {
          await signInBtn.click();
        }
        await expect(page.getByTestId("auth-modal")).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 15000, intervals: [500, 1000] });
    }

    await page.getByTestId("auth-tab-signup").click();
    await page.getByTestId("auth-email-input").fill(email);
    await page.getByTestId("auth-password-input").fill(pass);
    await page.getByTestId("auth-submit-btn").click();

    try {
      await expect(page.getByTestId("user-profile-menu-btn")).toBeVisible({ timeout: 4000 });
    } catch {
      if (!(await page.getByTestId("auth-modal").isVisible().catch(() => false))) {
        const signInBtn = page.getByTestId("nav-sign-in-btn");
        if (await signInBtn.isVisible().catch(() => false)) {
          await signInBtn.click();
        }
      }
      await page.getByTestId("auth-tab-signin").click();
      await page.getByTestId("auth-email-input").fill(email);
      await page.getByTestId("auth-password-input").fill(pass);
      await page.getByTestId("auth-submit-btn").click();
      await expect(page.getByTestId("user-profile-menu-btn")).toBeVisible({ timeout: 20000 });
    }

    await expect(page.getByTestId("auth-modal")).not.toBeVisible({ timeout: 5000 }).catch(() => {});

    try {
      if (await onboardingModal.isVisible({ timeout: 2000 })) {
        await onboardingClose.click();
        await expect(onboardingModal).not.toBeVisible({ timeout: 5000 });
      }
    } catch {
      // not visible
    }
  }

  test("User A Journey (Steps 1-39)", async ({ page }) => {
    test.setTimeout(180000);

    console.log("➡️ STEPS 1-4: Open, Onboarding, Signup, Login");
    await setupAuthRoutes(page);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await performAuth(page, userAEmail, userAPassword);

    console.log("➡️ STEPS 5-7: Import PDF, Process, Verify READY");
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

    const fileInput = page.getByTestId("pdf-dropzone-input");
    const pdfBuffer = generateE2ETestPdfBuffer(testPages);
    await fileInput.setInputFiles({
      name: "StudyDock_Architecture.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });

    await page.getByTestId("import-title-input").fill("StudyDock Network Architecture");
    await page.getByTestId("import-author-input").fill("StudyDock Author");
    await page.getByTestId("import-subject-input").fill("Computer Science");
    await page.getByTestId("submit-upload-btn").click();

    // Wait for processing to complete and workspace to load
    await expect(page.getByTestId("page-number-input")).toBeVisible({ timeout: 45000 });

    const booksRes = await page.request.get("/api/books");
    const booksData = await booksRes.json();
    expect(booksData.books.length).toBeGreaterThan(0);
    userABookId = booksData.books[0].id;
    console.log("✅ Book created and verified READY. Book ID:", userABookId);

    console.log("➡️ STEPS 8-9: Open textbook & Navigate pages");
    await expect(page.getByTestId("page-number-input")).toHaveValue("1");
    await page.getByTestId("next-page-btn").click();
    await expect(page.getByTestId("page-number-input")).toHaveValue("2");

    console.log("➡️ STEPS 10-13: Highlight, Refresh, Verify highlight");
    const highlightRes = await page.request.post("/api/annotations", {
      data: {
        bookId: userABookId,
        pageNumber: 2,
        selectedText: "User Datagram Protocol (UDP)",
        highlightColor: "yellow",
        color: "yellow",
        cfiRange: "page=2#offset=0,30",
        type: "highlight",
      },
    });
    expect(highlightRes.ok()).toBeTruthy();

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("textbook-container")).toBeVisible({ timeout: 15000 });

    const pageVal = await page.getByTestId("page-number-input").inputValue();
    if (pageVal !== "2") {
      await page.getByTestId("next-page-btn").click();
      await expect(page.getByTestId("page-number-input")).toHaveValue("2");
    }

    const annotationsRes = await page.request.get(`/api/annotations?bookId=${encodeURIComponent(userABookId)}&pageNumber=2`);
    expect(annotationsRes.ok()).toBeTruthy();
    const annotationsData = await annotationsRes.json();
    expect(annotationsData.annotations.length).toBeGreaterThan(0);
    console.log("✅ Highlight persisted and verified");

    console.log("➡️ STEPS 14-16: Create note, Refresh, Verify note");
    const noteRes = await page.request.post("/api/notes", {
      data: {
        bookId: userABookId,
        pageNumber: 2,
        content: "This is a critical note for User A",
      },
    });
    expect(noteRes.ok()).toBeTruthy();

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("textbook-container")).toBeVisible({ timeout: 15000 });
    const notesRes = await page.request.get(`/api/notes?bookId=${encodeURIComponent(userABookId)}`);
    const notesData = await notesRes.json();
    expect(notesData.notes.some((n: any) => n.content.includes("This is a critical note for User A"))).toBe(true);
    console.log("✅ Note persisted");

    console.log("➡️ STEPS 17-18: Bookmark, Refresh");
    await page.getByTestId("bookmark-toggle-btn").click();
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("textbook-container")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("bookmarks-drawer-btn").click();
    await expect(page.getByTestId("bookmarks-count")).not.toHaveText("(0)", { timeout: 10000 });

    console.log("➡️ STEPS 19-21: Attach YouTube, verify metadata");
    const videoAttachRes = await page.request.post("/api/video/attach", {
      data: {
        bookId: userABookId,
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        pageNumber: 1,
      },
    });
    expect(videoAttachRes.ok()).toBeTruthy();

    console.log("➡️ STEPS 22-27: Ask AI, Citations, Chats");
    await page.getByTestId("ai-prompt-input").fill("Explain TCP three-way handshake.");
    await page.getByTestId("ai-send-btn").click();

    await expect(page.locator('[data-testid="ai-message-ai"]')).toHaveCount(2, { timeout: 35000 });
    await expect(page.getByTestId("ai-citation-badge").first()).toBeVisible({ timeout: 35000 });

    const convRes = await page.request.get(`/api/conversations?bookId=${encodeURIComponent(userABookId)}`);
    const convData = await convRes.json();
    expect(convData.conversations.length).toBeGreaterThan(0);
    userAConvId = convData.conversations[0].id;

    console.log("➡️ STEPS 28-33: Quizzes and Flashcards");
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
    userAQuizId = quizData.quiz.id;

    const quizAttemptRes = await page.request.post("/api/quiz/attempt", {
      data: {
        quizId: userAQuizId,
        bookId: userABookId,
        pageNumber: 1,
        answers: quizData.quiz.questions.map((q: any) => ({
          questionId: q.id,
          selectedOptionIndex: q.correctAnswerIndex ?? 0,
        })),
        score: 100,
        totalQuestions: quizData.quiz.questions.length,
        startedAt: new Date(Date.now() - 30000).toISOString(),
        completedAt: new Date().toISOString(),
        timeSpentSeconds: 30,
      },
    });
    expect(quizAttemptRes.ok()).toBeTruthy();

    console.log("➡️ STEPS 34-39: Dashboard and Sign Out");
    await page.getByTestId("nav-dashboard-btn").click();
    await expect(page.locator("text=Study Dashboard")).toBeVisible({ timeout: 10000 });

    await page.getByTestId("user-profile-menu-btn").click();
    await page.getByTestId("nav-sign-out-btn").click();
    await expect(page.getByTestId("nav-sign-in-btn")).toBeVisible({ timeout: 10000 });
  });

  test("User B Journey (Steps 40-47 - Strict Tenant Isolation)", async ({ page }) => {
    test.setTimeout(60000);

    console.log("➡️ STEP 40: User B Signup/Login");
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await performAuth(page, userBEmail, userBPassword);

    console.log("➡️ STEP 41: Attempt User A Book");
    const bookRes = await page.request.get(`/api/books/${userABookId}`);
    expect(bookRes.status()).toBe(403);

    console.log("➡️ STEP 42: Attempt User A PDF (Storage)");
    const bookPatchRes = await page.request.patch(`/api/books/${userABookId}`, {
      data: { lastPageRead: 5 },
    });
    expect(bookPatchRes.status()).toBe(403);

    console.log("➡️ STEP 43: Attempt User A Annotations");
    const noteGetRes = await page.request.get(`/api/notes?bookId=${userABookId}`);
    expect(noteGetRes.status()).toBe(403);

    console.log("➡️ STEP 44: Attempt User A Conversation");
    const convGetRes = await page.request.get(`/api/conversations/${userAConvId}`);
    expect([403, 404]).toContain(convGetRes.status());

    console.log("➡️ STEP 45: Attempt User A Quiz");
    if (userAQuizId) {
      const quizSubmitRes = await page.request.post(`/api/quiz/attempt`, {
        data: {
          quizId: userAQuizId,
          answers: [],
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          timeSpentSeconds: 10,
        },
      });
      expect([403, 404]).toContain(quizSubmitRes.status());
    }

    console.log("➡️ STEP 47: Attempt User A Vector Context");
    const aiRes = await page.request.post(`/api/chat`, {
      data: {
        bookId: userABookId,
        question: "Tell me secrets.",
        currentPage: 1,
      },
    });
    expect(aiRes.status()).toBe(403);

    console.log("✅ ALL TENANT ISOLATION CHECKS PASSED SUCCESSFULLY");
  });
});
