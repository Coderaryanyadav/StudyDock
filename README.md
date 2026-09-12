# AI Study Workspace

> **"Read it. Watch it. Ask it. Understand it."**
>
> A production-grade digital study environment where students can study from a textbook, watch synchronized YouTube lectures, and interact with a context-aware AI academic tutor — all on a single unified screen.

---

## 🌟 Product Vision & Architecture

The **AI Study Workspace** eliminates app-switching fatigue for university students by combining:
1. **Digital Textbook Reader (Left Panel)**: High-fidelity reading canvas, table of contents drawer, bookmarks, zoom controls (50%–175%), search in document, annotation highlights, and floating text-selection action toolbar (`[Explain]`, `[Simplify]`, `[Example]`, `[Ask AI]`, `[Card]`, `[Quiz]`).
2. **YouTube Lecture Player (Top-Right Panel)**: Responsive 16:9 embedded player with timestamp tracking, "Connect Lecture" mapping, synchronized chapter markers, and direct textbook cross-links.
3. **AI Academic Tutor (Bottom-Right Panel)**: Context-aware academic tutor with streaming responses, KaTeX math notation ($x$, $$y$$), syntax-highlighted code blocks, grounded clickable citations that jump directly to textbook pages, 10 academic learning modes, and suggested follow-up chips.
4. **Study Dashboard**: Concept mastery tracking matrix (e.g. TCP 90%, UDP 80%, Subnetting 40%), personalized review recommendations, today's study plan checklist, study streaks, and interactive quizzes/flashcards.

---

## 🚀 Key Features

* **3-Panel Resizable Desktop Workspace**: Smooth draggable dividers (horizontal & vertical) with localStorage layout persistence and collapsible panels.
* **Mobile & Tablet Responsive Layout**: Automatic tabbed navigation (`📚 Textbook`, `🎥 Video`, `🤖 Tutor`) on smaller screens with smooth state preservation.
* **Text Selection Context Toolbar**: Select any text in the textbook to trigger contextual actions (`Explain`, `Simplify`, `Example`, `Ask AI`, `Flashcard`, `Quiz`).
* **10 Academic Learning Modes**:
  * ✨ **Explain**: Balanced conceptual breakdown
  * 👶 **Beginner**: Intuitive real-life analogies with zero technical jargon
  * 🔬 **Deep Dive**: Rigorous RFC-level mechanics and mathematical proofs
  * 🧪 **Example**: Concrete packet traces, code, and Wireshark captures
  * ❓ **Quiz**: Contextual check questions strictly from the current textbook page
  * 🎓 **Exam Mode**: High-yield exam questions and scoring criteria
  * 📇 **Flashcards**: Front/back key concept prompt cards
  * 📝 **Summary**: Executive revision notes and top 3 exam takeaways
  * 🧭 **Teach Me**: Step-by-step 4-stage interactive lecture
  * 🧠 **Socratic Mode**: Guiding questions to stimulate critical thinking
* **Grounded RAG Engine**: Retrieves relevant chunks and guarantees verified textbook citations (**Source: [Book Title] — Page [X]**). Clicking a citation immediately highlights and navigates to the textbook page.
* **Zero-Setup Out-of-the-Box Demo**: Preloaded with *Computer Networking: Principles & Protocols (Chapter 3: Transport Layer & TCP 3-Way Handshake)*, Stanford lecture sync, concept mastery scores, interactive quiz questions, and flashcards.

---

## 🛠️ Tech Stack

* **Framework**: Next.js 14+ (App Router)
* **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion
* **Math & Typography**: KaTeX, Google Fonts (Inter, Merriweather, JetBrains Mono)
* **AI & RAG**: Google Generative AI (`@google/generative-ai`) with intelligent zero-config contextual fallback engine
* **Video**: Official YouTube IFrame Embed API
* **Confetti**: Canvas-Confetti for mastery completion

---

## ⚡ Getting Started Locally

### 1. Clone & Install Dependencies

```bash
cd /path/to/LearnAi
npm install
```

### 2. Configure Environment Variables (Optional)

Create `.env.local` based on `.env.example`:

```bash
# Optional: Provide your Gemini API key for live custom textbook generation
# Get a free key at: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: YouTube Data API v3
YOUTUBE_API_KEY=
```

*(Note: If no API key is provided, the workspace automatically operates with its high-accuracy contextual simulation engine).*

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build & Test

```bash
npm run build
npm run start
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| `←` / `→` | Navigate to Previous / Next textbook page |
| `Cmd/Ctrl + D` | Toggle between Workspace and Study Dashboard |
| `?` | Open Keyboard Shortcuts help modal |
| `Enter` | Send message in AI Tutor |
| `Shift + Enter` | Insert newline in AI Tutor |
