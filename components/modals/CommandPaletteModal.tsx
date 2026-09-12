"use client";

import React, { useState, useEffect } from "react";
import { Search, BookOpen, Youtube, Sparkles, ArrowRight, HelpCircle, Layers, FileText } from "lucide-react";
import { Book, VideoLecture } from "@/types";

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book | null;
  video: VideoLecture | null;
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

  const filteredPages = book?.pages
    ? query.trim()
      ? book.pages.filter(
          (p) =>
            p.title.toLowerCase().includes(query.toLowerCase()) ||
            p.content.toLowerCase().includes(query.toLowerCase())
        )
      : book.pages.slice(0, 4)
    : [];

  const filteredVideoTopics = video?.topics
    ? query.trim()
      ? video.topics.filter(
          (t) =>
            t.title.toLowerCase().includes(query.toLowerCase()) ||
            t.summary.toLowerCase().includes(query.toLowerCase())
        )
      : video.topics.slice(0, 3)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#0d131f] border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-100 divide-y divide-slate-800">
        
        {/* Search Header */}
        <div className="p-3.5 flex items-center gap-3 bg-[#070b12]">
          <Search className="w-4 h-4 text-indigo-400 shrink-0" />
          <input
            type="text"
            placeholder="Search textbook pages, video topics, concepts, or actions (Cmd+K)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-xs md:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700 shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4 text-xs custom-scrollbar">
          {/* Quick Actions */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
              Workspace Actions
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  onSelectAction("quiz");
                  onClose();
                }}
                className="p-2.5 rounded-lg bg-[#070b12] hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-slate-200">Practice Quiz</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => {
                  onSelectAction("flashcards");
                  onClose();
                }}
                className="p-2.5 rounded-lg bg-[#070b12] hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-left transition-colors"
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
          {book && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                Textbook Pages ({book.title})
              </div>
              <div className="space-y-1">
                {filteredPages.map((page) => (
                  <button
                    key={page.pageNumber}
                    onClick={() => {
                      onNavigateToPage(page.pageNumber);
                      onClose();
                    }}
                    className="w-full p-2 rounded-lg bg-[#070b12] hover:bg-slate-800 border border-slate-800/80 flex items-center justify-between text-left transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate font-medium text-slate-200">{page.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">Page {page.pageNumber}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Video Topics */}
          {video && filteredVideoTopics.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                Video Lecture Topics
              </div>
              <div className="space-y-1">
                {filteredVideoTopics.map((topic, idx) => (
                  <button
                    key={`${topic.timestampSeconds}-${idx}`}
                    onClick={() => {
                      onNavigateToPage(topic.pageNumber);
                      onClose();
                    }}
                    className="w-full p-2 rounded-lg bg-[#070b12] hover:bg-slate-800 border border-slate-800/80 flex items-center justify-between text-left transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Youtube className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="truncate font-medium text-slate-200">{topic.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">{topic.formattedTime}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
