"use client";

import React, { useState } from "react";
import { X, RotateCcw, Check, Sparkles, Layers, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Flashcard } from "@/types";

interface FlashcardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  flashcards: Flashcard[];
  bookTitle?: string;
  chapterTitle?: string;
  pageNumber?: number;
}

export const FlashcardsModal: React.FC<FlashcardsModalProps> = ({
  isOpen,
  onClose,
  flashcards,
  bookTitle,
  chapterTitle,
  pageNumber,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [cards, setCards] = useState<Flashcard[]>(flashcards);

  React.useEffect(() => {
    setCards(flashcards);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [flashcards]);

  if (!isOpen) return null;

  const currentCard = cards[currentIndex] || cards[0];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const handleMarkStatus = (status: "learning" | "mastered") => {
    const cardToUpdate = cards[currentIndex];
    setCards((prev) =>
      prev.map((c, i) => (i === currentIndex ? { ...c, status } : c))
    );

    if (cardToUpdate?.id && !cardToUpdate.id.startsWith("temp-")) {
      fetch("/api/flashcards/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flashcardId: cardToUpdate.id,
          status,
        }),
      }).catch((err) => console.warn("Failed to persist flashcard review:", err));
    }

    handleNext();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Interactive Flashcards</h3>
              <p className="text-xs text-slate-400">
                {bookTitle ? `${bookTitle} ${pageNumber ? `— Page ${pageNumber}` : ""}` : chapterTitle || "Textbook Flashcards"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Counter and Status */}
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Card {currentIndex + 1} of {cards.length}</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 border border-slate-700/60 text-[10px]">
            {currentCard.concept}
          </span>
        </div>

        {/* 3D Flip Card Container */}
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className="min-h-[220px] p-6 rounded-3xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all shadow-inner flex flex-col justify-between relative group"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>{isFlipped ? "ANSWER / EXPLANATION" : "QUESTION / PROMPT"}</span>
            <span className="text-slate-400 flex items-center gap-1 group-hover:text-indigo-400 transition-colors">
              <Eye className="w-3.5 h-3.5" /> Click anywhere to flip
            </span>
          </div>

          <div className="py-6 text-center text-sm md:text-base font-medium text-slate-100 leading-relaxed">
            {isFlipped ? currentCard.answer : currentCard.question}
          </div>

          <div className="text-[10px] text-slate-500 text-center font-mono">
            📖 Verified from Page {currentCard.pageNumber}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handlePrev}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Previous Card"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleMarkStatus("learning")}
              className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors"
            >
              Still Learning
            </button>
            <button
              onClick={() => handleMarkStatus("mastered")}
              className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mastered</span>
            </button>
          </div>

          <button
            onClick={handleNext}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Next Card"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
