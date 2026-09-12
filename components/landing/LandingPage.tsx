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
  GraduationCap,
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
      a: "StudyDock grounds every query against your actual textbook PDF chunks and PostgreSQL pgvector embeddings. When you ask a question, the RAG engine retrieves the relevant page passages and gives verified [Textbook — p.X] and [YouTube — MM:SS] citations.",
    },
    {
      q: "Can I upload my own university textbooks and lecture slides?",
      a: "Yes! You can upload standard PDF course textbooks. StudyDock privately extracts text and vector chunks for your account, preserving your original PDF for reading.",
    },
    {
      q: "What makes this different from generic chat tools?",
      a: "StudyDock is a personal academic cloud workspace with a synchronized 3-panel desk: original PDF reader on the left, video lecture top-right, and grounded AI tutor bottom-right. It tracks your reading progress, notes, highlights, and concept mastery.",
    },
    {
      q: "Is an API key required?",
      a: "StudyDock connects to Google Gemini on the server with strict security, allowing authenticated students to study immediately with zero manual configuration.",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#080c14] text-slate-100 custom-scrollbar">
      
      {/* Hero Section */}
      <section className="relative pt-16 md:pt-24 pb-16 px-4 md:px-8 text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          <GraduationCap className="w-4 h-4" />
          <span>Academic Cloud Study Workspace</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
          Your entire study desk. <br />
          <span className="text-indigo-400">
            One unified screen.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Read your original textbook, watch synchronized YouTube lectures, and ask an AI tutor grounded in your exact page numbers — all without switching tabs.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={onStartStudying}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span>Open Study Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenDashboard}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#0f1624] hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Brain className="w-4 h-4 text-purple-400" />
            <span>Study Dashboard</span>
          </button>
        </div>

        {/* 3 Pillars */}
        <div className="pt-16 grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
          <div className="p-5 rounded-lg bg-[#0f1624] border border-slate-800 space-y-2">
            <div className="p-2 w-fit rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-white">Original PDF Reader</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Read your actual PDF with persistent bookmarks, resolution-independent highlights, and instant page jumps.
            </p>
          </div>

          <div className="p-5 rounded-lg bg-[#0f1624] border border-slate-800 space-y-2">
            <div className="p-2 w-fit rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Youtube className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-white">Linked Video Lectures</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Attach course lectures with timestamped captions, searchable transcripts, and one-click AI cross-referencing.
            </p>
          </div>

          <div className="p-5 rounded-lg bg-[#0f1624] border border-slate-800 space-y-2">
            <div className="p-2 w-fit rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Bot className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-white">Grounded AI Tutor</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Private ChatGPT-style tutoring with verified page and timestamp citations, LaTeX math formulas, and mastery tracking.
            </p>
          </div>
        </div>

        {/* FAQ Accordion */}
        <div className="pt-12 text-left space-y-3">
          <h2 className="text-xl font-bold text-white text-center pb-2">Frequently Asked Questions</h2>
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-lg bg-[#0f1624] border border-slate-800 overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-4 text-left font-semibold text-sm text-slate-200 flex items-center justify-between hover:text-white"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${openFaq === idx ? "rotate-180" : ""}`} />
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-slate-800/80 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>

      </section>

    </div>
  );
};
