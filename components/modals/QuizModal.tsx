"use client";

import React, { useState } from "react";
import { X, Check, AlertCircle, HelpCircle, ArrowRight, RotateCcw, Trophy } from "lucide-react";
import { QuizQuestion } from "@/types";
import { renderMathInText } from "@/lib/katex-renderer";

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId?: string | null;
  questions: QuizQuestion[];
  bookTitle?: string;
  chapterTitle?: string;
  pageNumber?: number;
  onFinishQuiz?: (data: {
    quizId?: string | null;
    answers: { questionId: string; selectedOptionId: string }[];
    startedAt: string;
    completedAt: string;
    timeSpentSeconds: number;
    concept?: string;
  }) => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  isOpen,
  onClose,
  quizId,
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
  const [recordedAnswers, setRecordedAnswers] = useState<{ questionId: string; selectedOptionId: string }[]>([]);
  const [startedAt, setStartedAt] = useState<string>(new Date().toISOString());

  // Reset when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setSelectedOptionId(null);
      setIsAnswerSubmitted(false);
      setScore(0);
      setIsCompleted(false);
      setRecordedAnswers([]);
      setStartedAt(new Date().toISOString());
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentQuestion = questions[currentIndex] || questions[0];

  const handleSelectOption = (optId: string) => {
    if (isAnswerSubmitted) return;
    setSelectedOptionId(optId);
  };

  const handleSubmitAnswer = () => {
    if (!selectedOptionId || isAnswerSubmitted || !currentQuestion) return;
    setIsAnswerSubmitted(true);

    const newAnswer = {
      questionId: currentQuestion.id,
      selectedOptionId,
    };
    setRecordedAnswers((prev) => [...prev, newAnswer]);

    const selectedOpt = currentQuestion.options.find((o) => o.id === selectedOptionId);
    if (selectedOpt?.isCorrect) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOptionId(null);
      setIsAnswerSubmitted(false);
    } else {
      setIsCompleted(true);
      const completedAt = new Date().toISOString();
      const timeSpentSeconds = Math.max(1, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000));
      if (onFinishQuiz) {
        const primaryConcept = questions[0]?.concept || "Core Concept";
        onFinishQuiz({
          quizId,
          answers: recordedAnswers,
          startedAt,
          completedAt,
          timeSpentSeconds,
          concept: primaryConcept,
        });
      }
    }
  };

  const handleResetQuiz = () => {
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setIsCompleted(false);
    setRecordedAnswers([]);
    setStartedAt(new Date().toISOString());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-modal-title"
      data-testid="quiz-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-xl bg-[#0d131f] border border-slate-800 rounded-xl p-6 md:p-8 shadow-2xl space-y-6 text-slate-100 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="quiz-modal-title" className="font-bold text-base text-white">Academic Practice Quiz</h3>
              <p className="text-xs text-slate-400">
                {bookTitle || "Textbook"} • Page {pageNumber || 1}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Quiz"
            data-testid="quiz-close-btn"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isCompleted ? (
          <div className="space-y-5">
            {/* Progress indicator */}
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span data-testid="quiz-progress-indicator">Question {currentIndex + 1} of {questions.length}</span>
              <span data-testid="quiz-live-score">Score: {score}/{currentIndex + (isAnswerSubmitted ? 1 : 0)}</span>
            </div>

            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                className="h-full bg-indigo-500 rounded-full transition-all duration-200"
              />
            </div>

            {/* Question prompt */}
            <div data-testid="quiz-question-prompt" className="text-sm md:text-base font-semibold text-white leading-relaxed">
              {renderMathInText(currentQuestion?.question || "Loading question...")}
            </div>

            {/* Options list */}
            <div className="space-y-2.5" role="radiogroup" aria-label="Quiz Answer Options">
              {currentQuestion?.options.map((opt, oIdx) => {
                const isSelected = selectedOptionId === opt.id;
                let optStyle = "bg-[#070b12] border-slate-800 text-slate-300 hover:border-slate-700";

                if (isAnswerSubmitted) {
                  if (opt.isCorrect) {
                    optStyle = "bg-emerald-500/10 border-emerald-500/50 text-emerald-300";
                  } else if (isSelected && !opt.isCorrect) {
                    optStyle = "bg-rose-500/10 border-rose-500/50 text-rose-300";
                  } else {
                    optStyle = "bg-[#070b12] border-slate-800/40 text-slate-500 opacity-60";
                  }
                } else if (isSelected) {
                  optStyle = "bg-indigo-600/20 border-indigo-500 text-white font-medium";
                }

                return (
                  <button
                    key={opt.id}
                    role="radio"
                    aria-checked={isSelected}
                    data-testid={`quiz-option-${oIdx}`}
                    onClick={() => handleSelectOption(opt.id)}
                    disabled={isAnswerSubmitted}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all flex items-center justify-between text-xs md:text-sm focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${optStyle}`}
                  >
                    <span>{renderMathInText(opt.text)}</span>
                    {isAnswerSubmitted && opt.isCorrect && (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation box */}
            {isAnswerSubmitted && currentQuestion?.explanation && (
              <div data-testid="quiz-explanation-box" className="p-3.5 rounded-lg bg-[#070b12] border border-slate-800 text-xs text-slate-300 space-y-1">
                <span className="font-semibold text-indigo-400 uppercase tracking-wider text-[10px]">Explanation:</span>
                <p className="leading-relaxed">{renderMathInText(currentQuestion.explanation)}</p>
              </div>
            )}

            {/* Submit / Next button */}
            <div className="pt-2 flex justify-end">
              {!isAnswerSubmitted ? (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!selectedOptionId}
                  aria-label="Submit Answer"
                  data-testid="quiz-submit-answer-btn"
                  className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  aria-label={currentIndex + 1 < questions.length ? "Next Question" : "View Results"}
                  data-testid="quiz-next-question-btn"
                  className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                >
                  <span>{currentIndex + 1 < questions.length ? "Next Question" : "View Results"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Completed Result Screen */
          <div data-testid="quiz-completed-screen" className="py-6 text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
              <Trophy className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h4 className="text-xl font-bold text-white">Quiz Completed</h4>
              <p className="text-xs text-slate-400" data-testid="quiz-final-score-display">
                You scored <strong className="text-indigo-400 font-bold">{score} out of {questions.length}</strong> ({Math.round((score / questions.length) * 100)}%)
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleResetQuiz}
                aria-label="Retry Quiz"
                data-testid="quiz-retry-btn"
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Quiz</span>
              </button>

              <button
                onClick={onClose}
                aria-label="Return to Workspace"
                data-testid="quiz-return-btn"
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                Return to Workspace
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
