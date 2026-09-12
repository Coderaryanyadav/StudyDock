import fs from "fs";
import path from "path";

console.log("==================================================");
console.log("PHASE 13: UI/UX REFINEMENT AUDIT & VERIFICATION");
console.log("==================================================");

// 1. Verify UI component files exist and have no fake mock data
const componentsToCheck = [
  "components/workspace/WorkspaceLayout.tsx",
  "components/workspace/TextbookPanel.tsx",
  "components/workspace/AITutorPanel.tsx",
  "components/workspace/VideoPanel.tsx",
  "components/navbar/WorkspaceNavbar.tsx",
  "components/dashboard/StudyDashboard.tsx",
  "components/library/LibraryModal.tsx",
  "components/modals/QuizModal.tsx",
  "components/modals/FlashcardsModal.tsx",
  "components/modals/DocumentUploadModal.tsx",
  "components/modals/ShortcutsModal.tsx",
];

let allComponentsExist = true;
for (const compPath of componentsToCheck) {
  const fullPath = path.join(process.cwd(), compPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing component: ${compPath}`);
    allComponentsExist = false;
  } else {
    const content = fs.readFileSync(fullPath, "utf-8");
    // Check that hardcoded demo fallbacks aren't introduced
    if (content.includes("demo-user") || content.includes("fake_quiz_score")) {
      console.error(`❌ Fake mock data detected in ${compPath}`);
      process.exit(1);
    }
  }
}

if (!allComponentsExist) {
  console.error("❌ Component integrity check failed.");
  process.exit(1);
}
console.log("✓ All workspace, dashboard, navigation, and modal components verified.");

// 2. Check for keyboard accessibility (focus-visible rings & aria labels)
const keyAccessibleComponents = [
  "components/workspace/TextbookPanel.tsx",
  "components/workspace/AITutorPanel.tsx",
  "components/navbar/WorkspaceNavbar.tsx",
  "components/modals/QuizModal.tsx",
  "components/modals/FlashcardsModal.tsx",
  "components/library/LibraryModal.tsx",
];

for (const compPath of keyAccessibleComponents) {
  const fullPath = path.join(process.cwd(), compPath);
  const content = fs.readFileSync(fullPath, "utf-8");
  if (!content.includes("focus-visible:") || !content.includes("aria-label")) {
    console.error(`❌ Accessibility focus-visible rings or aria-labels missing in: ${compPath}`);
    process.exit(1);
  }
}
console.log("✓ Keyboard accessibility and focus rings verified across key interactive components.");

// 3. Verify 3-panel workspace layout integrity
const layoutPath = path.join(process.cwd(), "components/workspace/WorkspaceLayout.tsx");
const layoutContent = fs.readFileSync(layoutPath, "utf-8");
if (
  !layoutContent.includes("TextbookPanel") ||
  !layoutContent.includes("VideoPanel") ||
  !layoutContent.includes("AITutorPanel")
) {
  console.error("❌ 3-panel workspace hierarchy compromised in WorkspaceLayout.tsx.");
  process.exit(1);
}
console.log("✓ 3-panel workspace structure (Textbook / YouTube / AI Tutor) confirmed.");

console.log("==================================================");
console.log("PHASE 13 UI/UX VERIFICATION COMPLETE: ALL PASS");
console.log("==================================================");
