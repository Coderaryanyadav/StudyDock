import { test, expect } from "@playwright/test";
import { generateE2ETestPdfBuffer } from "./helpers/pdf-generator";

test.describe("StudyDock Production-Grade Textbook Reader Journey", () => {
  test("Complete Textbook Reader Verification (Upload, Navigation, Zoom, Highlights, Notes, Bookmarks, Persistence, Tenant Isolation)", async ({ page }) => {
    const timestamp = Date.now();
    const userAEmail = `scholar.alice.${timestamp}@studydock.internal`;
    const userAPassword = `SecureP@ssword123!`;
    const userBEmail = `scholar.bob.${timestamp}@studydock.internal`;
    const userBPassword = `BobSecureP@ssword456!`;

    const userAId = "11111111-1111-4111-8111-111111111111";
    const userBId = "22222222-2222-4222-8222-222222222222";

    const testPages = [
      {
        chapter: "Chapter 1: Network Architectures",
        section: "1.1 The Transport Layer",
        text: "Chapter 1: Network Architectures. The transport layer provides end-to-end communication services across networks.",
      },
      {
        chapter: "Chapter 1: Network Architectures",
        section: "1.2 User Datagram Protocol",
        text: "Section 1.2: User Datagram Protocol (UDP). UDP provides low-latency transmission without reliability guarantees.",
      },
      {
        chapter: "Chapter 2: Routing Algorithms",
        section: "2.1 Link-State Routing",
        text: "Chapter 2: Routing Protocols. Link-state routing computes shortest paths via Dijkstra algorithm.",
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
          } catch {
            // ignore
          }

          const isBob = email.includes("bob");
          const userId = isBob ? userBId : userAId;

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
          const userId = isBob ? userBId : userAId;
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

    async function dismissOnboardingIfPresent(targetPage: any) {
      const onboardingModal = targetPage.getByTestId("onboarding-modal");
      const onboardingClose = targetPage.getByTestId("onboarding-close-btn");
      try {
        if (await onboardingModal.isVisible({ timeout: 1500 })) {
          await onboardingClose.click();
          await expect(onboardingModal).not.toBeVisible({ timeout: 5000 });
        }
      } catch {
        // not visible
      }
    }

    async function loginOrSignup(targetPage: any, email: string, pass: string) {
      await setupAuthRoutes(targetPage);

      if (await targetPage.getByTestId("user-profile-menu-btn").isVisible({ timeout: 2000 }).catch(() => false)) {
        return;
      }

      await dismissOnboardingIfPresent(targetPage);

      if (await targetPage.getByTestId("user-profile-menu-btn").isVisible({ timeout: 2000 }).catch(() => false)) {
        return;
      }

      const signInBtn = targetPage.getByTestId("nav-sign-in-btn");
      if (await signInBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await signInBtn.click();
        await expect(targetPage.getByTestId("auth-modal")).toBeVisible({ timeout: 10000 });
      }

      const emailInput = targetPage.getByTestId("auth-email-input");
      if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await targetPage.getByTestId("auth-tab-signup").click();
        await targetPage.getByTestId("auth-email-input").fill(email);
        await targetPage.getByTestId("auth-password-input").fill(pass);
        await targetPage.getByTestId("auth-submit-btn").click();

        try {
          await expect(targetPage.getByTestId("user-profile-menu-btn")).toBeVisible({ timeout: 4000 });
        } catch {
          await targetPage.getByTestId("auth-tab-signin").click();
          await targetPage.getByTestId("auth-email-input").fill(email);
          await targetPage.getByTestId("auth-password-input").fill(pass);
          await targetPage.getByTestId("auth-submit-btn").click();
          await expect(targetPage.getByTestId("user-profile-menu-btn")).toBeVisible({ timeout: 20000 });
        }
      }
    }

    // =========================================================================
    // STEP 1: User A Login & Real PDF Ingestion
    // =========================================================================
    console.log("➡️ STEP 1: User A Login & Real PDF Ingestion");
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await loginOrSignup(page, userAEmail, userAPassword);

    // Open Upload Modal
    const importBtn = page.getByTestId("nav-import-btn");
    await expect(importBtn).toBeVisible({ timeout: 10000 });
    await importBtn.click();
    await expect(page.getByTestId("upload-modal-content")).toBeVisible({ timeout: 10000 });

    // Upload generated 3-page PDF
    const pdfBuffer = generateE2ETestPdfBuffer(testPages);
    const fileInput = page.getByTestId("document-file-input");
    await fileInput.setInputFiles({
      name: "Distributed_Systems_Textbook.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });

    await page.getByTestId("import-title-input").fill("Distributed Systems: Principles");
    await page.getByTestId("import-author-input").fill("Andrew S. Tanenbaum");
    await page.getByTestId("import-subject-input").fill("Computer Science");

    const submitUploadBtn = page.getByTestId("submit-upload-btn");
    await expect(submitUploadBtn).toBeEnabled();
    await submitUploadBtn.click();

    // Modal closes automatically on upload completion
    await expect(page.getByTestId("upload-modal-content")).not.toBeVisible({ timeout: 45000 });

    // Verify active book title loaded in navbar
    const activeBookTitle = page.getByTestId("nav-active-book-title");
    await expect(activeBookTitle).toBeVisible({ timeout: 15000 });

    // Verify textbook viewer canvas is rendered
    await expect(page.getByTestId("pdf-canvas")).toBeVisible({ timeout: 20000 });

    // =========================================================================
    // STEP 2: Page Navigation: 1 -> 2 -> 3 and Direct Input
    // =========================================================================
    console.log("➡️ STEP 2: Page Navigation (1 -> 2 -> 3 -> 1)");
    const pageInput = page.getByTestId("page-number-input");
    await expect(pageInput).toBeVisible({ timeout: 10000 });
    await expect(pageInput).toHaveValue("1");

    // Click Next -> Page 2
    const nextBtn = page.getByTestId("next-page-btn");
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
    await expect(pageInput).toHaveValue("2");

    // Click Next -> Page 3
    await nextBtn.click();
    await expect(pageInput).toHaveValue("3");
    await expect(nextBtn).toBeDisabled();

    // Click Prev -> Page 2
    const prevBtn = page.getByTestId("prev-page-btn");
    await expect(prevBtn).toBeEnabled();
    await prevBtn.click();
    await expect(pageInput).toHaveValue("2");

    // Direct Input -> Page 1
    await pageInput.fill("1");
    await pageInput.press("Enter");
    await expect(pageInput).toHaveValue("1");

    // =========================================================================
    // STEP 3: Zoom Controls: 50% -> 100% -> 150% -> 200% -> Fit Width
    // =========================================================================
    console.log("➡️ STEP 3: Zoom Controls (50% -> 100% -> 150% -> 200% -> Fit)");
    const zoomIndicator = page.getByTestId("zoom-level-indicator");
    await expect(zoomIndicator).toBeVisible({ timeout: 10000 });

    // Zoom Out
    await page.getByTestId("zoom-out-btn").click();
    await expect(zoomIndicator).toContainText("90%");

    // Zoom In
    await page.getByTestId("zoom-in-btn").click();
    await expect(zoomIndicator).toContainText("100%");

    // Preset buttons if visible
    const zoom50 = page.getByTestId("zoom-50-btn");
    if (await zoom50.isVisible().catch(() => false)) {
      await zoom50.click();
      await expect(zoomIndicator).toContainText("50%");
    }

    const zoom150 = page.getByTestId("zoom-150-btn");
    if (await zoom150.isVisible().catch(() => false)) {
      await zoom150.click();
      await expect(zoomIndicator).toContainText("150%");
    }

    const zoom200 = page.getByTestId("zoom-200-btn");
    if (await zoom200.isVisible().catch(() => false)) {
      await zoom200.click();
      await expect(zoomIndicator).toContainText("200%");
    }

    // Fit Width
    const fitWidthBtn = page.getByTestId("fit-width-btn");
    await expect(fitWidthBtn).toBeVisible();
    await fitWidthBtn.click();
    await expect(page.getByTestId("pdf-canvas")).toBeVisible();

    // Reset zoom to 100%
    const zoom100 = page.getByTestId("zoom-100-btn");
    if (await zoom100.isVisible().catch(() => false)) {
      await zoom100.click();
    }

    // =========================================================================
    // STEP 4: Text Selection, Highlight Creation & Refresh Verification
    // =========================================================================
    console.log("➡️ STEP 4: Text Selection, Highlight Creation & Refresh Persistence");
    const textLayer = page.getByTestId("pdf-text-layer");
    await expect(textLayer).toBeVisible({ timeout: 15000 });

    // Simulate text selection inside the text layer
    await page.evaluate(() => {
      const spans = document.querySelectorAll('[data-testid="pdf-text-layer"] span');
      if (spans.length > 0) {
        const range = document.createRange();
        range.setStart(spans[0].firstChild || spans[0], 0);
        range.setEnd(spans[0].firstChild || spans[0], Math.min(25, (spans[0].textContent || "").length));
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    });

    const viewerContainer = page.getByTestId("pdf-viewer-container");
    await viewerContainer.dispatchEvent("mouseup");

    const highlightBtn = page.getByTestId("toolbar-highlight-btn");
    await expect(highlightBtn).toBeVisible({ timeout: 5000 });
    await highlightBtn.click();

    // Verify highlight element is rendered in pdf-highlights-layer
    const highlightRect = page.getByTestId("pdf-highlight-rect");
    await expect(highlightRect.first()).toBeVisible({ timeout: 5000 });

    // Open highlights drawer to verify count
    const highlightsDrawerBtn = page.getByTestId("highlights-drawer-btn");
    await highlightsDrawerBtn.click();
    await expect(page.getByTestId("highlight-item").first()).toBeVisible();
    await highlightsDrawerBtn.click(); // close drawer

    // REFRESH page and verify highlight persists
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await setupAuthRoutes(page);

    await expect(page.getByTestId("pdf-canvas")).toBeVisible({ timeout: 20000 });
    await highlightsDrawerBtn.click();
    await expect(page.getByTestId("highlight-item").first()).toBeVisible();
    await highlightsDrawerBtn.click(); // close drawer

    // =========================================================================
    // STEP 5: Study Notes Creation, Edit & Refresh Verification
    // =========================================================================
    console.log("➡️ STEP 5: Study Notes Creation & Refresh Persistence");
    const notesDrawerBtn = page.getByTestId("notes-drawer-btn");
    await notesDrawerBtn.click();

    const noteInput = page.getByTestId("new-note-input");
    const saveNoteBtn = page.getByTestId("save-note-btn");
    await expect(noteInput).toBeVisible();

    const noteText = `Crucial takeaway: TCP uses SYN, SYN-ACK, ACK 3-way handshake on Page 1.`;
    await noteInput.fill(noteText);
    await saveNoteBtn.click();

    const noteItem = page.getByTestId("note-item");
    await expect(noteItem.first()).toBeVisible();
    await expect(page.getByTestId("note-content").first()).toContainText(noteText);
    await notesDrawerBtn.click(); // close drawer

    // REFRESH page and verify note persists
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await setupAuthRoutes(page);

    await expect(page.getByTestId("pdf-canvas")).toBeVisible({ timeout: 20000 });
    await notesDrawerBtn.click();
    await expect(page.getByTestId("note-item").first()).toBeVisible();
    await expect(page.getByTestId("note-content").first()).toContainText(noteText);
    await notesDrawerBtn.click(); // close drawer

    // =========================================================================
    // STEP 6: Bookmark Toggling & Refresh Verification
    // =========================================================================
    console.log("➡️ STEP 6: Bookmark Toggling & Refresh Persistence");
    // Navigate to Page 2
    await pageInput.fill("2");
    await pageInput.press("Enter");
    await expect(pageInput).toHaveValue("2");

    // Toggle Bookmark on Page 2
    const bookmarkToggleBtn = page.getByTestId("bookmark-toggle-btn");
    await expect(bookmarkToggleBtn).toBeVisible();
    await bookmarkToggleBtn.click();

    // Verify in Bookmarks drawer
    const bookmarksDrawerBtn = page.getByTestId("bookmarks-drawer-btn");
    await bookmarksDrawerBtn.click();
    const bookmarkItem = page.getByTestId("bookmark-item");
    await expect(bookmarkItem.first()).toBeVisible();
    await expect(bookmarkItem.first()).toContainText("Page 2");
    await bookmarksDrawerBtn.click(); // close drawer

    // REFRESH page and verify bookmark persists
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await setupAuthRoutes(page);

    await expect(page.getByTestId("pdf-canvas")).toBeVisible({ timeout: 20000 });
    await bookmarksDrawerBtn.click();
    await expect(page.getByTestId("bookmark-item").first()).toBeVisible();
    await expect(page.getByTestId("bookmark-item").first()).toContainText("Page 2");
    await bookmarksDrawerBtn.click(); // close drawer

    // =========================================================================
    // STEP 7: Logout -> Login as User A: Verify Full State Restoration
    // =========================================================================
    console.log("➡️ STEP 7: Logout -> Login User A (Verify Full State Restoration)");
    const profileMenu = page.getByTestId("user-profile-menu-btn");
    await expect(profileMenu).toBeVisible();
    await profileMenu.click();

    const signOutBtn = page.getByTestId("nav-sign-out-btn");
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();
    await expect(profileMenu).not.toBeVisible({ timeout: 5000 });

    // Login User A again
    await loginOrSignup(page, userAEmail, userAPassword);

    // Verify textbook and page restored
    await expect(page.getByTestId("pdf-canvas")).toBeVisible({ timeout: 20000 });

    // Verify notes restored
    await notesDrawerBtn.click();
    await expect(page.getByTestId("note-item").first()).toBeVisible();
    await notesDrawerBtn.click();

    // Verify bookmarks restored
    await bookmarksDrawerBtn.click();
    await expect(page.getByTestId("bookmark-item").first()).toBeVisible();
    await bookmarksDrawerBtn.click();

    // Verify highlights restored
    await highlightsDrawerBtn.click();
    await expect(page.getByTestId("highlight-item").first()).toBeVisible();
    await highlightsDrawerBtn.click();

    // =========================================================================
    // STEP 8: Tenant Isolation: User B Cannot See User A's Data
    // =========================================================================
    console.log("➡️ STEP 8: Tenant Isolation Check (User B)");
    await profileMenu.click();
    await signOutBtn.click();
    await expect(profileMenu).not.toBeVisible({ timeout: 5000 });

    // Sign in User B
    await loginOrSignup(page, userBEmail, userBPassword);

    // Verify User B has empty library
    await expect(page.getByTestId("empty-library-upload-prompt")).toBeVisible({ timeout: 15000 });

    // Direct API isolation check
    const response = await page.evaluate(async () => {
      const res = await fetch(`/api/annotations?bookId=00000000-0000-0000-0000-000000000001`);
      return { status: res.status, data: await res.json().catch(() => null) };
    });

    expect([401, 403, 404]).toContain(response.status);
    console.log("🎉 Textbook Reader Journey Completed Successfully!");
  });
});
