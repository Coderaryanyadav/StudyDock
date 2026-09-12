"use client";

import React, { useState } from "react";
import { X, Check, AlertCircle, HelpCircle, ArrowRight, RotateCcw, Trophy, Sparkles } from "lucide-react";
import { QuizQuestion } from "@/types";

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: QuizQuestion[];
  bookTitle?: string;
  chapterTitle?: string;
  pageNumber?: number;
  onFinishQuiz?: (score: number, total: number) => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  isOpen,
  onClose,
  questions,
  bookTitle,
  chapterTitle,
  pageNumber,
  onFinishQuiz,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentQuestion = questions[currentIndex] || questions[0];

  const handleSelectOption = (optId: string) => {
    if (isAnswerSubmitted) return;
    setSelectedOptionId(optId);
  };

  const handleSubmitAnswer = () => {
    if (!selectedOptionId || isAnswerSubmitted) return;
    setIsAnswerSubmitted(true);

    const selectedOpt = currentQuestion.options.find((o) => o.id === selectedOptionId);
    if (selectedOpt?.isCorrect) {
      setScore((prev) => prev + 1);
    }
  };

  const triggerConfetti = async () => {
    if (typeof window !== "undefined") {
      try {
        const confettiModule = await import("canvas-confetti");
        const confetti = confettiModule.default || confettiModule;
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // Fallback gracefully
      }
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOptionId(null);
      setIsAnswerSubmitted(false);
    } else {
      setIsCompleted(true);
      if (score + (currentQuestion.options.find((o) => o.id === selectedOptionId)?.isCorrect ? 1 : 0) >= questions.length * 0.7) {
        triggerConfetti();
      }
      if (onFinishQuiz) {
        onFinishQuiz(score, questions.length);
      }
    }
  };

  const handleResetQuiz = () => {
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setIsCompleted(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 text-slate-100 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Interactive Practice Quiz</h3>
              <p className="text-xs text-slate-400">
                {bookTitle ? `${bookTitle} ${pageNumber ? `— Page ${pageNumber}` : ""}` : chapterTitle || "Textbook Material"}
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

        {/* Completion Screen */}
        {isCompleted ? (
          <div className="py-6 text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mx-auto shadow-lg shadow-indigo-900/30">
              <Trophy className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h4 className="text-2xl font-bold text-white">Quiz Completed!</h4>
              <p className="text-sm text-slate-400 mt-1">
                You scored <strong className="text-indigo-400 font-mono text-base">{score} / {questions.length}</strong> ({Math.round((score / questions.length) * 100)}%)
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 max-w-sm mx-auto space-y-1">
              <div className="font-semibold text-emerald-400 flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Concept Mastery Updated
              </div>
              <p className="text-[11px] text-slate-400">
                Your performance has been recorded into your personal mastery matrix.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleResetQuiz}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Quiz</span>
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/30"
              >
                Done & Return
              </button>
            </div>
          </div>
        ) : (
          /* Active Question View */
          <div className="space-y-5">
            {/* Progress indicator */}
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Question {currentIndex + 1} of {questions.length}</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700/60">
                {currentQuestion.difficulty.toUpperCase()}
              </span>
            </div>

            {/* Question Text */}
            <div className="text-sm md:text-base font-semibold text-slate-100 leading-snug">
              {currentQuestion.question}
            </div>

            {/* Options List */}
            <div className="space-y-2.5">
              {currentQuestion.options.map((option) => {
                const isSelected = selectedOptionId === option.id;
                let optionStyle = "bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700";

                if (isAnswerSubmitted) {
                  if (option.isCorrect) {
                    optionStyle = "bg-emerald-950/40 border-emerald-500 text-emerald-200";
                  } else if (isSelected && !option.isCorrect) {
                    optionStyle = "bg-rose-950/40 border-rose-500 text-rose-200";
                  } else {
                    optionStyle = "bg-slate-950/30 border-slate-800/40 text-slate-500";
                  }
                } else if (isSelected) {
                  optionStyle = "bg-indigo-950/50 border-indigo-500 text-indigo-200";
                }

                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelectOption(option.id)}
                    disabled={isAnswerSubmitted}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all text-xs font-medium flex items-center justify-between ${optionStyle}`}
                  >
                    <span>{option.text}</span>
                    {isAnswerSubmitted && option.isCorrect && (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                    )}
                    {isAnswerSubmitted && isSelected && !option.isCorrect && (
                      <X className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation box after submit */}
            {isAnswerSubmitted && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1 animate-in fade-in duration-200">
                <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Explanation:</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {currentQuestion.explanation}
                </p>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              {!isAnswerSubmitted ? (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!selectedOptionId}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/30"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
                >
                  <span>{currentIndex + 1 === questions.length ? "Finish Quiz" : "Next Question"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
