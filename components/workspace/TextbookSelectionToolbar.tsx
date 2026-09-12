"use client";

import React from "react";
import { Sparkles, HelpCircle, Layers, BookOpen, Lightbulb, MessageSquareQuote } from "lucide-react";
import { LearningMode } from "@/types";

interface TextbookSelectionToolbarProps {
  position: { x: number; y: number } | null;
  selectedText: string;
  onAction: (action: "explain" | "simplify" | "example" | "ask" | "flashcard" | "quiz" | "highlight" | "note", mode?: LearningMode) => void;
  onClose: () => void;
}

export const TextbookSelectionToolbar: React.FC<TextbookSelectionToolbarProps> = ({
  position,
  selectedText,
  onAction,
}) => {
  if (!position || !selectedText) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: `${Math.max(16, Math.min(position.x, window.innerWidth - 380))}px`,
        top: `${Math.max(64, position.y - 48)}px`,
        zIndex: 50,
      }}
      className="animate-in fade-in zoom-in-95 duration-150 flex items-center gap-1 p-1 bg-slate-900/95 backdrop-blur-md border border-indigo-500/40 shadow-xl shadow-indigo-950/40 rounded-xl text-xs font-medium text-slate-200"
    >
      <button
        onClick={() => onAction("explain", "explain")}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        title="Explain this selected text with AI"
      >
        <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
        <span>Explain</span>
      </button>

      <button
        onClick={() => onAction("simplify", "beginner")}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
        title="Explain simply with beginner analogies"
      >
        <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
        <span>Simplify</span>
      </button>

      <button
        onClick={() => onAction("example", "example")}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
        title="Give real-world practical example"
      >
        <Layers className="w-3.5 h-3.5 text-cyan-400" />
        <span>Example</span>
      </button>

      <button
        onClick={() => onAction("ask")}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
        title="Ask custom question about selected text"
      >
        <MessageSquareQuote className="w-3.5 h-3.5 text-purple-400" />
        <span>Ask</span>
      </button>

      <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />

      <button
        onClick={() => onAction("flashcard", "flashcards")}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition-colors"
        title="Create a study flashcard from this selection"
      >
        <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline">Card</span>
      </button>

      <button
        onClick={() => onAction("quiz", "quiz")}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-rose-300 transition-colors"
        title="Generate a quiz question on this concept"
      >
        <HelpCircle className="w-3.5 h-3.5 text-rose-400" />
        <span className="hidden sm:inline">Quiz</span>
      </button>

      <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />

      <button
        onClick={() => onAction("highlight")}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-amber-500/20 text-amber-300 transition-colors"
        title="Highlight selection and save"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
        <span className="hidden sm:inline">Highlight</span>
      </button>
    </div>
  );
};
