# StudyDock Baseline Audit (Phase 0)

## 1. Current Architecture
- **Framework**: Next.js 16.3.5 (App Router, Turbopack) + React 18.3.1 + TypeScript 5.7.3.
- **Styling**: Tailwind CSS 3.4.17 with refined dark academic design tokens (`#080c14`, `#0f1624`, `#1e293b`, `#4f46e5`).
- **Database & Storage**: PostgreSQL 15+ with `pgvector` extension hosted via Supabase (`@supabase/supabase-js`, `@supabase/ssr`).
- **AI & Embeddings**: Google Gemini API (`@google/generative-ai`, `gemini-1.5-flash`, `text-embedding-004` with 768 dimensions).
- **PDF Engine**: `pdf-parse` on backend for text & chapter extraction; PDF.js on frontend for canvas rendering.
- **UI Workspace Architecture**:
  - Desktop 3-Panel Learning Desk (`WorkspaceLayout.tsx`):
    - Left: Original PDF reader (`TextbookPanel.tsx` + `PdfViewer.tsx`).
    - Top-Right: Linked YouTube video lecture (`VideoPanel.tsx`).
    - Bottom-Right: Grounded AI Academic Tutor (`AITutorPanel.tsx`).
  - Top Navigation (`WorkspaceNavbar.tsx`) with breadcrumbs and `⌘K` search palette.
  - Study Dashboard (`StudyDashboard.tsx`) with dynamic concept mastery matrix, reading progress, and active study streak.
  - Academic Library (`LibraryModal.tsx`) with volume covers and progress tracking.

---

## 2. Current Working Features
1. **Authentication & Session Boundary**:
   - Supabase SSR cookie auth (`lib/supabase/server.ts`, `lib/supabase/client.ts`).
   - Strict `401 Unauthorized` for unauthenticated requests on protected endpoints.
2. **Textbook Ingestion & Storage**:
   - Magic bytes validation (`%PDF-`) and non-PDF rejection (`lib/documents/processor.ts`).
   - 1:1 physical page mapping preserved in `book_pages`.
   - Private Supabase Storage bucket upload (`textbooks/{userId}/{bookId}/original.pdf`).
3. **Reader & Annotations**:
   - PDF.js rendering with zoom controls.
   - Resolution-independent highlight geometry (`boundingRect`, `rects`) persisted to `highlights`.
   - Persistent page bookmarks in `bookmarks`.
   - Full Notes CRUD (create, read, update, delete) in `notes`.
4. **YouTube Lecture Integration**:
   - 11-character regex extraction for all URL formats.
   - Public oEmbed metadata retrieval (`title`, `channelName`).
   - Real timed caption parsing into timestamped segments; displays truthful `"Transcript unavailable"` when captions are absent.
5. **Dual-Source RAG Intelligence**:
   - Hybrid retrieval across `pgvector` similarity search (`match_book_chunks` RPC) + keyword ranking.
   - Distinct citations: `[Textbook — p.X]` (jumps PDF reader) and `[YouTube — MM:SS]` (seeks video player).
   - Strict out-of-domain constraint against hallucinations.
6. **Practice Quizzes & Concept Mastery**:
   - Dynamic Gemini question generation from textbook chunks.
   - Real quiz attempt recording and dynamic mathematical mastery calculation ($masteryPercentage = \text{round}(\frac{\text{correct}}{\text{attempted}} \times 100)$).
   - Weak concept flagging ($<60\%$).
7. **Flashcards & Spaced Repetition**:
   - Flashcard generation and state transition reviews (`unseen` $\rightarrow$ `learning` $\rightarrow$ `mastered`).
8. **Study Sessions & Dashboard**:
   - Active minute tracking during visible browser tab state.
   - Streak and query count aggregation.

---

## 3. Current Broken / Partial Features
1. **Offline Test Runner Dependency on Supabase**:
   - Standalone script `scripts/verify-phase6-persistence.ts` failed when run without a local `.env.local` because `createAdminClient()` returned `null`.
2. **Scanned / Image-Only PDFs**:
   - Documents without a text layer are detected and marked as `OCR_REQUIRED`, but Tesseract OCR is not bundled in the Next.js runtime.
3. **Third-Party OAuth Handshake**:
   - OAuth redirect flow requires client IDs and redirect URIs registered in Supabase.

---

## 4. Fake / Demo / Fallback Logic Found
1. `lib/demo/demo-data.ts`:
   - Quarantined offline test fixtures. Guarded by `isDemoMode()` (`DEMO_MODE=true`).
2. `lib/supabase/auth.ts`:
   - `isDemoMode()` returns a mock user (`demo-user-001`) only when `process.env.DEMO_MODE === "true"`. In production, strictly returns `null`.
3. `lib/rag/embeddings.ts`:
   - Contains a deterministic hash fallback vector generator if Gemini API key is offline or missing during batch tests.

---

## 5. Database / Schema Mismatches
- **Schema (`database/schema.sql`)**:
  - Fully defined with `profiles`, `books`, `book_pages`, `book_chunks`, `chapters`, `sections`, `videos`, `video_transcripts`, `conversations`, `messages`, `notes`, `highlights`, `bookmarks`, `quizzes`, `quiz_questions`, `quiz_attempts`, `flashcards`, `flashcard_reviews`, `study_sessions`, and `concept_mastery`.
  - All foreign keys cascade on delete.
  - Vector column `book_chunks.embedding` is `vector(768)` matching Gemini `text-embedding-004`.
  - RLS policies enabled on all tables with `auth.uid() = user_id`.

---

## 6. Security Risks
1. **Environment Secret Leaks**:
   - `SUPABASE_SERVICE_ROLE_KEY` is present in server-side `lib/supabase/admin.ts` and must never be exposed to client bundles.
2. **Multi-Tenant Ownership Verification**:
   - All API routes (`/api/notes`, `/api/annotations`, `/api/quiz/generate`, `/api/flashcards/generate`, `/api/flashcards/review`, `/api/books/[id]/video`, `/api/progress`) strictly enforce `verifyBookOwnership(userId, bookId)`.
3. **Prompt Injection**:
   - Handled via `sanitizePromptText` stripping XML/HTML control tags.
4. **Rate Limiting**:
   - In-memory sliding-window limiter on AI generation endpoints.

---

## 7. Tests Currently Available
| Test Script | Status | Coverage |
| :--- | :--- | :--- |
| `scripts/final-production-audit.ts` | ✅ **16/16 Passed** | PDF validation, YouTube oEmbed, Dual-Source RAG, Prompt Guard, Rate Limit, Concept Mastery |
| `scripts/verify-security-rag.ts` | ✅ **22/22 Passed** | Prompt injection, Rate limiting, Vector cosine similarity, Tenant isolation, Physical page identity |
| `scripts/verify-phase4-reader.ts` | ✅ **17/17 Passed** | Multi-page parsing, Reading state persistence, Highlight geometry, Bookmarks, PDF delivery security |
| `scripts/verify-phase5-intelligence.ts` | ✅ **15/15 Passed** | RAG retrieval, Strict grounding, Multi-conversation threads, Multi-tenant isolation |
| `scripts/verify-phase3-lifecycle.ts` | ✅ **21/21 Passed** | Magic bytes, Page extraction, Storage object hierarchy, Cascading delete |
| `scripts/verify-phase7-video.ts` | ✅ **6/6 Passed** | YouTube ID extraction, oEmbed, Transcript fallback, Dual citations |
| `scripts/verify-phase6-persistence.ts` | ⚠️ *Requires Live Supabase* | Live database writes for notes, highlights, quizzes, flashcards |

---

## 8. Exact Commands Used
```bash
npm run lint
npx tsc --noEmit
npm run build
npx tsx scripts/final-production-audit.ts
npx tsx scripts/verify-security-rag.ts
npx tsx scripts/verify-phase4-reader.ts
npx tsx scripts/verify-phase5-intelligence.ts
npx tsx scripts/verify-phase3-lifecycle.ts
npx tsx scripts/verify-phase7-video.ts
```

---

## 9. Exact Failures
1. `scripts/verify-phase6-persistence.ts`:
   - Error: `Admin Supabase client unavailable. Check environment variables.`
   - Cause: Live Supabase database credentials (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are not provided in local environment.

---

## 10. Recommended Order for Fixing & Deployment
1. **Supabase Cloud Provisioning**: Execute `database/schema.sql` in Supabase SQL Editor to initialize tables, pgvector index, and RLS policies.
2. **Storage Bucket Configuration**: Create private storage bucket `textbooks` with authenticated RLS read/write access.
3. **Environment Setup**: Populate `.env.local` with `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
4. **End-to-End User Testing**: Execute full live user journey (Sign up $\rightarrow$ Upload PDF $\rightarrow$ Study $\rightarrow$ YouTube $\rightarrow$ AI Tutor $\rightarrow$ Quizzes $\rightarrow$ Flashcards $\rightarrow$ Dashboard).
