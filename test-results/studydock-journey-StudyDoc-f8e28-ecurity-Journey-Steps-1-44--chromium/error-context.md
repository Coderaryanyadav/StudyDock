# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: studydock-journey.spec.ts >> StudyDock Real End-to-End Test Suite (Phase 14) >> Phase 14 Complete Real User Study & Security Journey (Steps 1-44)
- Location: tests/e2e/studydock-journey.spec.ts:65:7

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByTestId('nav-sign-in-btn')
    - locator resolved to <button data-testid="nav-sign-in-btn" aria-label="Sign In or Create Account" class="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">…</div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">…</div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    235 × waiting for element to be visible, enabled and stable
        - element is visible, enabled and stable
        - scrolling into view if needed
        - done scrolling
        - <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">…</div> intercepts pointer events
      - retrying click action
        - waiting 500ms

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - button "StudyDock Home" [ref=e5] [cursor=pointer]:
        - generic [ref=e10]: StudyDock
      - navigation "Main Navigation" [ref=e11]:
        - button "Workspace View" [ref=e12] [cursor=pointer]:
          - generic [ref=e15]: Workspace
        - button "Dashboard View" [ref=e16] [cursor=pointer]:
          - generic [ref=e22]: Dashboard
        - button "Overview View" [ref=e23] [cursor=pointer]:
          - generic [ref=e26]: Overview
      - generic [ref=e27]:
        - button "Open Command Palette Search (Cmd+K)" [ref=e28] [cursor=pointer]:
          - generic [ref=e32]: Search
          - generic [ref=e33]: ⌘K
        - button "Open Academic Library" [ref=e34] [cursor=pointer]:
          - generic [ref=e37]: My Library
        - button "Import Textbook PDF" [ref=e38] [cursor=pointer]:
          - generic [ref=e42]: Import Book
        - generic [ref=e43]:
          - button "Open Practice Quiz" [ref=e44] [cursor=pointer]
          - button "Review Study Flashcards" [ref=e48] [cursor=pointer]
          - button "View Keyboard Shortcuts" [ref=e53] [cursor=pointer]
        - button "Sign In or Create Account" [ref=e57] [cursor=pointer]:
          - generic [ref=e61]: Sign In
    - main [ref=e62]:
      - generic [ref=e63]:
        - generic [ref=e67]:
          - heading "Welcome to StudyDock" [level=2] [ref=e68]
          - paragraph [ref=e69]: Import your course textbook PDF to read, watch synchronized lectures, and study with an AI tutor grounded in your exact page numbers.
        - generic [ref=e70]:
          - button "Import Textbook PDF" [ref=e71] [cursor=pointer]
          - button "Open Library" [ref=e76] [cursor=pointer]
    - generic [ref=e81]:
      - generic [ref=e82]:
        - generic [ref=e83]:
          - generic [ref=e84]: Step 1 of 3
          - generic [ref=e85]: StudyDesk Welcome
        - button [ref=e86] [cursor=pointer]
      - generic [ref=e90]:
        - generic [ref=e95]:
          - heading "Welcome to StudyDock" [level=3] [ref=e96]
          - paragraph [ref=e97]: "Your personal academic study desk: original textbook reading, linked YouTube lecture sync, and private AI tutoring grounded in your exact page numbers."
        - generic [ref=e98]:
          - generic [ref=e103]:
            - generic [ref=e104]: Original PDF Textbook Reader
            - generic [ref=e105]: Read your actual PDF with bookmarks and persistent highlights.
          - generic [ref=e111]:
            - generic [ref=e112]: Synchronized Video Lectures
            - generic [ref=e113]: Timestamped transcripts mapped directly to course concepts.
          - generic [ref=e119]:
            - generic [ref=e120]: Context-Aware AI Academic Tutor
            - generic [ref=e121]: Grounded answers with [Textbook — p.X] and [YouTube — MM:SS] citations.
        - button "Continue" [ref=e123] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=e132] [cursor=pointer]
  - alert [ref=e136]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { generateE2ETestPdfBuffer } from "./helpers/pdf-generator";
  3   | 
  4   | test.describe.serial("StudyDock Real End-to-End Test Suite (Phase 14)", () => {
  5   |   const timestamp = Date.now();
  6   |   const userAEmail = `scholar.alice.${timestamp}@studydock.internal`;
  7   |   const userAPassword = `SecureP@ssword123!`;
  8   |   const userBEmail = `scholar.bob.${timestamp}@studydock.internal`;
  9   |   const userBPassword = `BobSecureP@ssword456!`;
  10  | 
  11  |   let userABookId: string = "";
  12  |   let userAConvId: string = "";
  13  |   let userAQuizId: string = "";
  14  |   let userAFlashcardId: string = "";
  15  | 
  16  |   // Test multi-page PDF content
  17  |   const testPages = [
  18  |     {
  19  |       chapter: "Chapter 1: Network Architectures",
  20  |       section: "1.1 The Transport Layer",
  21  |       text: "Chapter 1: Network Architectures. The transport layer provides end-to-end communication services. Transmission Control Protocol (TCP) guarantees reliable, in-order delivery of data through a three-way handshake: SYN, SYN-ACK, ACK. It utilizes sequence numbers and acknowledgments to ensure packet integrity across lossy networks.",
  22  |     },
  23  |     {
  24  |       chapter: "Chapter 1: Network Architectures",
  25  |       section: "1.2 User Datagram Protocol",
  26  |       text: "Section 1.2: User Datagram Protocol (UDP). UDP is a connectionless transport protocol providing low-latency transmission without reliability guarantees or flow control mechanisms. It is widely used in real-time streaming, online gaming, and DNS queries where speed takes precedence over packet loss.",
  27  |     },
  28  |     {
  29  |       chapter: "Chapter 2: Routing Algorithms",
  30  |       section: "2.1 Link-State Routing",
  31  |       text: "Chapter 2: Routing Protocols. Link-state routing algorithms like Dijkstra algorithm compute the shortest path across a network graph by flooding link-state packets to all nodes.",
  32  |     },
  33  |   ];
  34  | 
  35  |   async function loginOrSignup(targetPage: any, email: string, pass: string) {
  36  |     const profileMenu = targetPage.getByTestId("user-profile-menu-btn");
  37  |     if (await profileMenu.isVisible()) {
  38  |       return;
  39  |     }
  40  | 
  41  |     const emailInput = targetPage.getByTestId("auth-email-input");
  42  |     if (!(await emailInput.isVisible())) {
  43  |       const signInBtn = targetPage.getByTestId("nav-sign-in-btn");
  44  |       if (await signInBtn.isVisible()) {
> 45  |         await signInBtn.click();
      |                         ^ Error: locator.click: Test timeout of 120000ms exceeded.
  46  |       }
  47  |     }
  48  | 
  49  |     await targetPage.getByTestId("auth-tab-signup").click();
  50  |     await targetPage.getByTestId("auth-email-input").fill(email);
  51  |     await targetPage.getByTestId("auth-password-input").fill(pass);
  52  |     await targetPage.getByTestId("auth-submit-btn").click();
  53  |     await targetPage.waitForTimeout(1000);
  54  | 
  55  |     const isProfileVisible = await profileMenu.isVisible();
  56  |     if (!isProfileVisible) {
  57  |       await targetPage.getByTestId("auth-tab-signin").click();
  58  |       await targetPage.getByTestId("auth-email-input").fill(email);
  59  |       await targetPage.getByTestId("auth-password-input").fill(pass);
  60  |       await targetPage.getByTestId("auth-submit-btn").click();
  61  |     }
  62  |     await expect(targetPage.getByTestId("user-profile-menu-btn")).toBeVisible({ timeout: 20000 });
  63  |   }
  64  | 
  65  |   test("Phase 14 Complete Real User Study & Security Journey (Steps 1-44)", async ({ page, request, context }) => {
  66  |     // =========================================================================
  67  |     // STEP 1: Create & Login User A
  68  |     // =========================================================================
  69  |     console.log("➡️ STEP 1: Create & Login User A");
  70  |     await page.goto("/");
  71  |     await page.waitForLoadState("domcontentloaded");
  72  |     await loginOrSignup(page, userAEmail, userAPassword);
  73  | 
  74  |     // =========================================================================
  75  |     // STEPS 2-4: Import Real PDF, Wait for Processing, Verify READY
  76  |     // =========================================================================
  77  |     console.log("➡️ STEPS 2-4: Import Real PDF & Verify Processing to READY");
  78  |     const pdfBuffer = generateE2ETestPdfBuffer(testPages);
  79  | 
  80  |     // Open Upload Modal
  81  |     const importBtn = page.getByTestId("nav-import-btn");
  82  |     if (await importBtn.isVisible()) {
  83  |       await importBtn.click();
  84  |     } else {
  85  |       const emptyImportBtn = page.getByTestId("empty-import-btn");
  86  |       await emptyImportBtn.click();
  87  |     }
  88  | 
  89  |     await expect(page.getByTestId("pdf-dropzone-input")).toBeAttached();
  90  | 
  91  |     // Set file via file input
  92  |     await page.getByTestId("pdf-dropzone-input").setInputFiles({
  93  |       name: "Computer_Networking_A_Top_Down_Approach.pdf",
  94  |       mimeType: "application/pdf",
  95  |       buffer: pdfBuffer,
  96  |     });
  97  | 
  98  |     await page.getByTestId("import-title-input").fill("Computer Networking: Principles");
  99  |     await page.getByTestId("import-author-input").fill("Kurose & Ross");
  100 |     await page.getByTestId("import-subject-input").fill("Computer Science");
  101 | 
  102 |     // Submit upload
  103 |     await page.getByTestId("import-submit-btn").click();
  104 | 
  105 |     // Wait for processing modal to complete and workspace to load
  106 |     await expect(page.getByTestId("page-number-input")).toBeVisible({ timeout: 45000 });
  107 | 
  108 |     // Fetch user books from backend to get the real created bookId
  109 |     const booksRes = await page.request.get("/api/books");
  110 |     expect(booksRes.ok()).toBeTruthy();
  111 |     const booksData = await booksRes.json();
  112 |     expect(booksData.success).toBe(true);
  113 |     expect(booksData.books.length).toBeGreaterThan(0);
  114 | 
  115 |     const uploadedBook = booksData.books[0];
  116 |     userABookId = uploadedBook.id;
  117 |     expect(uploadedBook.status).toBe("READY");
  118 |     expect(uploadedBook.totalPages).toBeGreaterThanOrEqual(3);
  119 |     console.log(`✅ Book created and verified READY. Book ID: ${userABookId}`);
  120 | 
  121 |     // =========================================================================
  122 |     // STEPS 5-6: Open Textbook & Navigate to Real Page
  123 |     // =========================================================================
  124 |     console.log("➡️ STEPS 5-6: Open Textbook & Navigate to Page 2");
  125 |     await page.getByTestId("next-page-btn").click();
  126 |     await expect(page.getByTestId("page-number-input")).toHaveValue("2");
  127 | 
  128 |     // =========================================================================
  129 |     // STEPS 7-10: Select Text, Create Highlight, Refresh, Verify Persistence
  130 |     // =========================================================================
  131 |     console.log("➡️ STEPS 7-10: Create Highlight & Verify Persistence on Refresh");
  132 |     // Create highlight via API / UI on Page 2
  133 |     const highlightRes = await page.request.post("/api/annotations", {
  134 |       data: {
  135 |         bookId: userABookId,
  136 |         pageNumber: 2,
  137 |         type: "highlight",
  138 |         selectedText: "UDP is a connectionless transport protocol providing low-latency transmission",
  139 |         color: "yellow",
  140 |         positionData: {
  141 |           boundingRect: { x: 0.1, y: 0.2, width: 0.8, height: 0.05 },
  142 |         },
  143 |       },
  144 |     });
  145 |     expect(highlightRes.ok()).toBeTruthy();
```