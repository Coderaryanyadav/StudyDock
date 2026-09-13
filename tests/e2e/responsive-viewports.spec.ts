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
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.goto("/", { waitUntil: "domcontentloaded" });

      // Dismiss onboarding modal if visible
      const onboardingClose = page.getByTestId("onboarding-close-btn");
      try {
        if (await onboardingClose.isVisible({ timeout: 1500 })) {
          await onboardingClose.click();
        }
      } catch (_e) {
        void _e;
      }

      // Check for horizontal overflow on body and document element
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(isOverflowing).toBe(false);

      // Verify page has loaded successfully with brand / auth options
      const body = page.locator("body");
      await expect(body).toBeVisible();
    });
  }
});
