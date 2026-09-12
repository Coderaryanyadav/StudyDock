# STUDYDOCK — Production AI Academic Study Workspace

> **"Read it. Watch it. Ask it. Understand it."**
>
> A production-grade multi-modal study platform where students read verified textbooks, watch synchronized lectures, and interact with a context-aware AI tutor with grounded citations — all on a single unified screen.

---

## 🏛️ System Architecture

```text
                               STUDYDOCK
                                   │
                     ┌─────────────┴─────────────┐
                     │                           │
                  FRONTEND                    BACKEND
                     │                           │
             ┌───────┼────────┐         ┌────────┼────────┐
             │       │        │         │        │        │
         Textbook  Video    Tutor      Auth    Documents  AI/RAG
             │       │        │         │        │        │
             └───────┼────────┘         │        │        │
                     │                  │        │        │
                     └──── Context ─────┴────────┴────────┘
                               │
                               ▼
                          RAG ENGINE
                               │
                   ┌───────────┼───────────┐
                   ▼           ▼           ▼
              PostgreSQL    pgvector    Storage
             (Supabase)   (Embeddings) (Private)
```

---

## 🚀 Key Production Capabilities

1. **Real PDF Document Processing Pipeline**:
   - Signature header verification (`%PDF-`).
   - Real page extraction with `pdf-parse`.
   - Intelligent sliding-window chunking preserving sentence boundaries and overlapping context.
   - Chapter & section hierarchy extraction via regex heuristics.
   - Vector embeddings generated using Gemini `text-embedding-004` (768 dimensions).
   - Automated private storage bucket upload with user isolation.

2. **Real Vector & Hybrid RAG Retrieval**:
   - `pgvector` HNSW vector similarity search (`match_book_chunks` RPC).
   - Multi-factor reranker combining semantic cosine similarity, keyword frequency, current page proximity boost (+0.3), and highlighted text match bonus (+0.5).
   - Verifiable, grounded citations referencing real stored chunks.

3. **Grounded AI Academic Tutor**:
   - Streaming response delivery via Server-Sent Events (SSE).
   - KaTeX LaTeX math formula rendering (`$formula$` and `$$formula$$`).
   - 10 Pedagogical learning modes (`Explain`, `Beginner`, `Deep Dive`, `Example`, `Quiz`, `Exam Mode`, `Flashcards`, `Summary`, `Teach Me`, `Socratic`).
   - Clickable citation tags that instantly navigate to and highlight source pages.

4. **Security & Prompt Defense Architecture**:
   - XML tag delimiter boundary protection against prompt injection attempts.
   - Strict Row Level Security (RLS) policies on all tables (`users`, `books`, `book_pages`, `book_chunks`, `conversations`, `messages`, `study_sessions`).
   - In-memory token-bucket rate limiters on AI chat, PDF processing, quizzes, and flashcards.
   - Safe error masking without leaking server internals.

5. **3-Panel Desktop Workspace & Synchronized Lecture Player**:
   - Draggable horizontal and vertical dividers with localStorage dimension persistence.
   - Mini-player collapsible mode (`[—] Minimize Video`) allowing flexible workspace organization.
   - Text selection floating toolbar with instant AI actions.
   - Out-of-the-box offline demo mode when unconfigured, seamlessly upgrading to cloud Supabase + Gemini when keys are provided.

---

## 🛠️ Database Setup (Supabase PostgreSQL + pgvector)

1. Create a project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Open [`database/schema.sql`](./database/schema.sql) and execute the entire script.
4. The schema will automatically:
   - Enable the `vector` extension.
   - Create tables: `users`, `books`, `book_pages`, `book_chunks`, `chapters`, `sections`, `videos`, `video_segments`, `book_video_links`, `conversations`, `messages`, `highlights`, `notes`, `flashcards`, `quizzes`, `quiz_questions`, `quiz_attempts`, `concepts`, `student_concepts`, `study_sessions`.
   - Create HNSW cosine similarity index `idx_book_chunks_embedding`.
   - Create the `match_book_chunks(...)` RPC function.
   - Configure Row Level Security (RLS) policies.

---

## ⚡ Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your credentials:

```ini
# Google Gemini AI (Required for AI Tutor & text-embedding-004)
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase PostgreSQL & pgvector (Required for Cloud Database, Auth & Vector RAG)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: YouTube Data API v3
YOUTUBE_API_KEY=your_youtube_api_key_here
```

---

## 💻 Local Development & Build

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Lint check
npm run lint

# 4. Production build
npm run build

# 5. Start production server
npm run start
```

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `←` / `→` | Previous / Next textbook page |
| `Cmd/Ctrl + K` | Search Workspace / Command Palette |
| `Cmd/Ctrl + D` | Toggle between Workspace and Study Dashboard |
| `?` | Keyboard Shortcuts help modal |
| `Enter` | Send prompt to AI Academic Tutor |
| `Shift + Enter` | Insert newline in tutor prompt |

---

## 📜 License

MIT License. Educational and academic study tool.
