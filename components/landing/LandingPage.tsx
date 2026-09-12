"use client";

import React, { useState } from "react";
import {
  Sparkles,
  BookOpen,
  Youtube,
  Bot,
  ArrowRight,
  CheckCircle2,
  Layers,
  Brain,
  ShieldCheck,
  Zap,
  HelpCircle,
  Play,
  ChevronDown,
} from "lucide-react";

interface LandingPageProps {
  onStartStudying: () => void;
  onOpenDashboard: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartStudying,
  onOpenDashboard,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: "How does the AI Tutor know what textbook page I am studying?",
      a: "The workspace continuously tracks your reading coordinates, active chapter, selected text, and video playback timestamp. When you ask a question, our Retrieval-Augmented Generation (RAG) engine constructs a grounded context snapshot and attaches verified page citations.",
    },
    {
      q: "Can I upload my own university textbooks and lecture slides?",
      a: "Yes! You can upload PDFs that you have permission to use. The built-in document parser automatically extracts sections, detects page numbers, and creates searchable vector chunks for tutoring.",
    },
    {
      q: "What makes this different from generic ChatGPT?",
      a: "Unlike generic chat tools that lack your study materials and hallucinate references, AI Study Workspace is a dedicated 3-panel academic desk. It guarantees grounded textbook citations, synchronizes with YouTube lectures, supports 10 pedagogical modes (including Socratic reasoning), and tracks your concept mastery over time.",
    },
    {
      q: "Is an API key required to use the workspace?",
      a: "No! The workspace ships with high-fidelity pre-indexed demo data and an intelligent contextual engine that works 100% out of the box with zero configuration. You can also plug in your own Google Gemini API key for live custom textbook generation.",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white custom-scrollbar">
      {/* Hero Section */}
      <section className="relative pt-12 md:pt-20 pb-16 px-4 md:px-8 text-center max-w-5xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>The Next-Generation Digital Study Desk</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight md:leading-none">
          Your entire study desk. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            One single screen.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Read your textbook, watch synchronized YouTube lectures, and master complex concepts with a context-aware AI tutor — without ever switching tabs.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={onStartStudying}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2"
          >
            <span>Start Studying Free</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenDashboard}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Brain className="w-4 h-4 text-purple-400" />
            <span>Open Study Dashboard</span>
          </button>
        </div>

        {/* Value Prop Tagline */}
        <div className="pt-2 text-xs font-mono uppercase tracking-widest text-slate-500">
          &ldquo;Read it. Watch it. Ask it. Understand it.&rdquo;
        </div>

        {/* Realistic 3-Panel Workspace Interactive Mockup Preview */}
        <div className="pt-8 max-w-5xl mx-auto">
          <div
            onClick={onStartStudying}
            className="p-2 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl shadow-indigo-950/40 hover:border-indigo-500/50 cursor-pointer transition-all group relative overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 bg-slate-950 rounded-2xl border border-slate-800/80 text-xs text-slate-400 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                <span className="ml-2 font-mono text-[11px] text-slate-300">
                  AI Study Workspace — Computer Networking (Page 72)
                </span>
              </div>
              <span className="text-[11px] text-indigo-400 font-semibold group-hover:underline flex items-center gap-1">
                Launch Live App <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            {/* Simulated 3-Panel Preview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 h-72 md:h-96 text-left">
              {/* Left: Textbook */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden">
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-indigo-400 uppercase">
                    Textbook Reader • Page 72
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm">
                    3.3 TCP Three-Way Handshake
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Before a client and server can exchange payload data using TCP, they must establish a connection through the Three-Way Handshake...
                  </p>
                  <div className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-[11px] font-mono text-indigo-300">
                    SYN (seq=x) → SYN-ACK (ack=x+1) → ACK
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-900 pt-2">
                  <span>Selected text → Explain / Quiz</span>
                  <span className="text-amber-400">★ Bookmark</span>
                </div>
              </div>

              {/* Right: Top Video + Bottom AI Tutor */}
              <div className="flex flex-col gap-2 h-full">
                {/* Top: Video */}
                <div className="h-1/2 bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between relative overflow-hidden">
                  <div className="space-y-1 z-10">
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-mono">
                      YouTube Lecture (04:00)
                    </span>
                    <h4 className="font-semibold text-xs text-white">
                      TCP Connection Establishment & ISN
                    </h4>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      ● Synced with p.72
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-red-600/30 border border-red-500 flex items-center justify-center text-white">
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>
                </div>

                {/* Bottom: AI Tutor */}
                <div className="h-1/2 bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-400">
                      <Sparkles className="w-3 h-3" />
                      <span>AI Tutor Response (Mode: Deep Dive)</span>
                    </div>
                    <p className="text-[11px] text-slate-300 line-clamp-2">
                      &ldquo;TCP requires 3 messages to prevent delayed duplicate SYN packets from opening phantom half-open connections on the server...&rdquo;
                    </p>
                  </div>
                  <div className="text-[10px] font-mono text-indigo-300 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    <span>Source: Computer Networks — Page 72</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem & Solution Section */}
      <section className="py-16 px-4 md:px-8 max-w-5xl mx-auto border-t border-slate-800/80 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            The Traditional Way of Studying is Broken
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Switching between 5 different browser tabs ruins focus and breaks context.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="text-2xl">😫</div>
            <h4 className="font-semibold text-white text-base">App Switching Fatigue</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Jumping between a PDF reader in one window, YouTube in another, and ChatGPT in a third destroys study flow.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="text-2xl">🤥</div>
            <h4 className="font-semibold text-white text-base">Hallucinated AI Answers</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Standard chatbots guess formulas and quote nonexistent textbook sections instead of referencing your actual syllabus.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="text-2xl">🎯</div>
            <h4 className="font-semibold text-white text-base">The AI Study Workspace</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Unified 3-panel desk where textbook, video lecture, and grounded AI tutor communicate in real time.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Breakdown: 10 Learning Modes */}
      <section className="py-16 px-4 md:px-8 max-w-5xl mx-auto border-t border-slate-800/80 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-mono uppercase text-indigo-400 font-semibold tracking-wider">
            Pedagogical Intelligence
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            10 Tailored Academic Learning Modes
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            From intuitive beginner analogies to Socratic questioning and exam grading rubrics.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { name: "Explain", icon: "✨", desc: "Balanced conceptual breakdowns" },
            { name: "Beginner", icon: "👶", desc: "Analogies with zero jargon" },
            { name: "Deep Dive", icon: "🔬", desc: "Rigorous RFC & math formulas" },
            { name: "Example", icon: "🧪", desc: "Real packet captures & code" },
            { name: "Quiz", icon: "❓", desc: "Contextual check questions" },
            { name: "Exam Mode", icon: "🎓", desc: "High-yield midterm grading" },
            { name: "Flashcards", icon: "📇", desc: "Spaced repetition cards" },
            { name: "Summary", icon: "📝", desc: "High-density revision notes" },
            { name: "Teach Me", icon: "🧭", desc: "Interactive 4-step lesson" },
            { name: "Socratic", icon: "🧠", desc: "Guiding discovery questions" },
          ].map((mode, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-1.5 hover:border-indigo-500/50 transition-colors"
            >
              <div className="text-2xl">{mode.icon}</div>
              <div className="font-semibold text-xs text-white">{mode.name}</div>
              <div className="text-[10px] text-slate-400 leading-snug">{mode.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4 md:px-8 max-w-3xl mx-auto border-t border-slate-800/80 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-slate-400">Everything you need to know before getting started.</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full text-left p-4 flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-200 hover:text-white"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    openFaq === idx ? "rotate-180 text-indigo-400" : ""
                  }`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3 animate-in fade-in">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4 text-center bg-gradient-to-b from-slate-950 to-indigo-950/40 border-t border-slate-800/80 space-y-5">
        <h2 className="text-3xl font-bold text-white tracking-tight">
          Ready to supercharge your study sessions?
        </h2>
        <p className="text-sm text-slate-300 max-w-md mx-auto">
          Launch your workspace now with zero setup required.
        </p>
        <button
          onClick={onStartStudying}
          className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-xl shadow-indigo-600/40 inline-flex items-center gap-2"
        >
          <span>Open AI Study Workspace</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
};
