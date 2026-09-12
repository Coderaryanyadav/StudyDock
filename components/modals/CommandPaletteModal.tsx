"use client";

import React, { useState, useEffect } from "react";
import { Search, BookOpen, Youtube, Sparkles, X, ArrowRight, HelpCircle, Layers, FileText } from "lucide-react";
import { Book, VideoLecture } from "@/types";

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  video: VideoLecture;
  onNavigateToPage: (page: number) => void;
  onSelectAction: (action: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  book,
  video,
  onNavigateToPage,
  onSelectAction,
}) => {
  const [query, setQuery] = useState<string>("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredPages = query.trim()
    ? book.pages.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.content.toLowerCase().includes(query.toLowerCase())
      )
    : book.pages.slice(0, 4);

  const filteredVideoTopics = query.trim()
    ? video.topics.filter((t) =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.summary.toLowerCase().includes(query.toLowerCase())
      )
    : video.topics.slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl shadow-indigo-950/60 overflow-hidden text-slate-100 divide-y divide-slate-800">
        {/* Search Header */}
        <div className="p-4 flex items-center gap-3 bg-slate-950/40">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            type="text"
            placeholder="Search textbook pages, video topics, concepts, or actions (Cmd+K)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-slate-400 border border-slate-700 shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4 text-xs custom-scrollbar">
          {/* Quick Actions */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
              Quick Workspace Actions
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  onSelectAction("quiz");
                  onClose();
                }}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-slate-200">Take Practice Quiz</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => {
                  onSelectAction("flashcards");
                  onClose();
                }}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-slate-200">Review Flashcards</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Textbook Results */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center justify-between">
              <span>Textbook Sections</span>
              <span className="text-[10px] text-slate-500 font-mono">Pages</span>
            </div>
            <div className="space-y-1">
              {filteredPages.map((p) => (
                <button
                  key={p.pageNumber}
                  onClick={() => {
                    onNavigateToPage(p.pageNumber);
                    onClose();
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800 border border-transparent hover:border-slate-700/60 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="p-1 rounded bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shrink-0">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">
                        {p.title}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {p.chapterTitle}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-indigo-400 font-semibold text-[11px] shrink-0 ml-2">
                    p.{p.pageNumber}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Video Topic Results */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center justify-between">
              <span>Video Topics</span>
              <span className="text-[10px] text-slate-500 font-mono">Timestamp</span>
            </div>
            <div className="space-y-1">
              {filteredVideoTopics.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onNavigateToPage(t.pageNumber);
                    onClose();
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800 border border-transparent hover:border-slate-700/60 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="p-1 rounded bg-red-600/20 text-red-400 border border-red-500/30 shrink-0">
                      <Youtube className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-semibold text-slate-200 group-hover:text-red-300 transition-colors">
                        {t.title}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {t.summary}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-red-400 font-semibold text-[11px] shrink-0 ml-2">
                    {t.formattedTime}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500">
          <span>Navigate with <strong>↑</strong> <strong>↓</strong> and press <strong>Enter</strong></span>
          <span>AI Study Workspace Command Center</span>
        </div>
      </div>
    </div>
  );
};
