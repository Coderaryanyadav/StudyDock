"use client";

import React, { useState } from "react";
import { X, RotateCcw, Check, Layers, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Flashcard } from "@/types";
import { renderMathInText } from "@/lib/katex-renderer";

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

  if (!isOpen || cards.length === 0) return null;

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
    <div data-testid="flashcards-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#0d131f] border border-slate-800 rounded-xl p-6 md:p-8 shadow-2xl space-y-6 text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Study Flashcards</h3>
              <p className="text-xs text-slate-400">
                {bookTitle ? `${bookTitle} ${pageNumber ? `• Page ${pageNumber}` : ""}` : chapterTitle || "Course Flashcards"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Flashcards"
            data-testid="flashcard-close-btn"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Counter and Status */}
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span data-testid="flashcard-counter">Card {currentIndex + 1} of {cards.length}</span>
          <span data-testid="flashcard-concept" className="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 text-[11px]">
            {currentCard?.concept || "Concept"}
          </span>
        </div>

        {/* Flip Card Area */}
        <div
          role="button"
          tabIndex={0}
          data-testid="flashcard-flip-card"
          aria-label={isFlipped ? "Flashcard answer shown. Click to flip back." : "Flashcard question shown. Click to flip to answer."}
          onClick={() => setIsFlipped(!isFlipped)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsFlipped(!isFlipped);
            }
          }}
          className="min-h-[220px] rounded-lg bg-[#070b12] border border-slate-800 hover:border-slate-700 cursor-pointer p-6 flex flex-col justify-between transition-colors relative focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
        >
          <div className="flex justify-between items-center text-[11px] font-mono text-slate-500">
            <span data-testid="flashcard-side-label">{isFlipped ? "ANSWER / EXPLANATION" : "QUESTION / PROMPT"}</span>
            <span className="flex items-center gap-1 text-slate-400">
              <Eye className="w-3.5 h-3.5" />
              <span>Click or Space to flip</span>
            </span>
          </div>

          <div data-testid="flashcard-content-text" className="text-center py-6 text-base md:text-lg font-semibold text-white leading-relaxed">
            {renderMathInText(isFlipped ? currentCard?.answer || "" : currentCard?.question || "")}
          </div>

          <div className="text-center text-[10px] text-slate-500 font-mono">
            {isFlipped ? "Flip back" : "Tap anywhere or press Space to reveal definition"}
          </div>
        </div>

        {/* Navigation & Review Buttons */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              aria-label="Previous Flashcard"
              data-testid="flashcard-prev-btn"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              title="Previous card"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              aria-label="Next Flashcard"
              data-testid="flashcard-next-btn"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              title="Next card"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleMarkStatus("learning")}
              aria-label="Mark status as Still Learning"
              data-testid="flashcard-learning-btn"
              className="px-3.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Still Learning</span>
            </button>

            <button
              onClick={() => handleMarkStatus("mastered")}
              aria-label="Mark status as Mastered"
              data-testid="flashcard-mastered-btn"
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mastered</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
