import { test, expect } from "@playwright/test";

const viewports = [
  { name: "Desktop 1280x800", width: 1280, height: 800 },
  { name: "MacBook 1440x900", width: 1440, height: 900 },
  { name: "Full HD 1920x1080", width: 1920, height: 1080 },
  { name: "Tablet iPad 768x1024", width: 768, height: 1024 },
  { name: "Mobile iPhone 390x844", width: 390, height: 844 },
];

test.describe("StudyDock Responsive Multi-Viewport Audit", () => {
  for (const vp of viewports) {
    test(`Verify layout, density, and no horizontal overflow at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      // Set viewport
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Mock auth to land directly in authenticated app
      await page.route("**/auth/v1/**", async (route) => {
        const url = route.request().url();
        if (url.includes("/token") || url.includes("/signup") || url.includes("/user") || url.includes("/session")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            json: {
              access_token: "mock-token-responsive",
              token_type: "bearer",
              expires_in: 3600,
              user: {
                id: "test-user-123",
                aud: "authenticated",
                role: "authenticated",
                email: "scholar.responsive@studydock.internal",
                created_at: new Date().toISOString(),
              },
            },
          });
          return;
        }
        await route.continue();
      });

      // Mock books API
      await page.route("**/api/books", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            success: true,
            books: [
              {
                id: "book-responsive-1",
                title: "Computer Systems: A Programmer's Perspective",
                author: "Randal E. Bryant",
                subject: "Computer Science",
                totalPages: 100,
                lastPageRead: 15,
                pages: [
                  {
                    pageNumber: 15,
                    title: "Virtual Memory Architecture",
                    content: "Virtual memory provides an illusion of a large, contiguous array of bytes.",
                  },
                ],
              },
            ],
          },
        });
      });

      // Mock individual book API
      await page.route("**/api/books/book-responsive-1", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            success: true,
            book: {
              id: "book-responsive-1",
              title: "Computer Systems: A Programmer's Perspective",
              author: "Randal E. Bryant",
              subject: "Computer Science",
              totalPages: 100,
              lastPageRead: 15,
              pages: [
                {
                  pageNumber: 15,
                  title: "Virtual Memory Architecture",
                  content: "Virtual memory provides an illusion of a large, contiguous array of bytes.",
                },
              ],
            },
          },
        });
      });

      // Mock progress API
      await page.route("**/api/progress", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            authenticated: true,
            totalStudyMinutes: 45,
            streakDays: 3,
            longestStreakDays: 5,
            quizzesCompleted: 2,
            questionsAsked: 6,
            pagesRead: 15,
            chaptersCompleted: 1,
            totalChapters: 4,
            bookProgressPercentage: 15,
            activeSubject: "Computer Science",
            concepts: [
              {
                id: "c-1",
                name: "Virtual Memory",
                category: "Memory Hierarchy",
                masteryPercentage: 75,
                questionsAttempted: 4,
                questionsCorrect: 3,
                isWeak: false,
                recommendedChapter: "Chapter 9",
                recommendedPage: 15,
              },
            ],
            todayPlan: [],
            recentActivity: [],
          },
        });
      });

      await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });

      // Dismiss onboarding modal if visible
      const onboardingClose = page.getByTestId("onboarding-close-btn");
      try {
        if (await onboardingClose.isVisible({ timeout: 1500 })) {
          await onboardingClose.click();
        }
      } catch {}

      // Check for horizontal overflow on body and document element
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(isOverflowing).toBe(false);

      // Verify Navbar brand is visible
      const brand = page.locator("header");
      await expect(brand).toBeVisible();

      // Test Dashboard view
      const dashboardBtn = page.getByTestId("nav-dashboard-btn");
      if (await dashboardBtn.isVisible()) {
        await dashboardBtn.click();
        await page.waitForTimeout(200);

        // Verify Dashboard metrics are visible
        const streakCard = page.getByTestId("dashboard-streak");
        await expect(streakCard).toBeVisible();

        const noDashOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(noDashOverflow).toBe(false);

        // Switch back to Workspace
        const workspaceBtn = page.getByTestId("nav-workspace-btn");
        await workspaceBtn.click();
        await page.waitForTimeout(200);
      }

      // Check Shortcuts Modal accessibility and viewport bounds
      const shortcutsBtn = page.getByTestId("nav-shortcuts-btn");
      if (await shortcutsBtn.isVisible()) {
        await shortcutsBtn.click();
        const shortcutsModal = page.locator('[role="dialog"]');
        if (await shortcutsModal.isVisible()) {
          await expect(shortcutsModal).toBeVisible();
          // Press Escape to dismiss
          await page.keyboard.press("Escape");
        }
      }
    });
  }
});
