"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, GraduationCap, BookOpen, Youtube, ArrowRight, Check, Bot } from "lucide-react";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<number>(1);
  const [selectedSubject, setSelectedSubject] = useState<string>("Computer Science");
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus modal container on mount
    modalRef.current?.focus();

    // Escape key listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const subjects = [
    "Computer Science & Systems",
    "Calculus & Linear Algebra",
    "Physics & Engineering",
    "Biology & Medicine",
    "Economics & Finance",
  ];

  const handleFinish = () => {
    onComplete();
    onClose();
  };

  return (
    <div
      data-testid="onboarding-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-lg bg-[#0d131f] border border-slate-800 rounded-xl p-6 md:p-8 shadow-2xl space-y-6 text-slate-100 relative outline-none focus:ring-1 focus:ring-indigo-500/50"
      >
        {/* Step indicator & Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              Step {step} of 3
            </span>
            <span className="text-xs text-slate-400 font-medium">StudyDock Welcome</span>
          </div>
          <div className="flex items-center gap-1">
            {step < 3 && (
              <button
                onClick={onClose}
                data-testid="onboarding-skip-btn"
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800/60 transition-colors"
              >
                Skip
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close Onboarding"
              data-testid="onboarding-close-btn"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 id="onboarding-modal-title" className="text-xl font-bold text-white">
                Welcome to StudyDock
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Your personal academic study desk: original textbook reading, linked YouTube lecture sync, and private AI tutoring grounded in your exact page numbers.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <div className="p-3 rounded-lg bg-[#070b12] border border-slate-800 text-xs flex items-center gap-3">
                <div className="p-2 rounded bg-indigo-500/10 text-indigo-400"><BookOpen className="w-4 h-4" /></div>
                <div>
                  <div className="font-semibold text-slate-200">Original PDF Textbook Reader</div>
                  <div className="text-[11px] text-slate-400">Read your actual PDF with bookmarks and persistent highlights.</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#070b12] border border-slate-800 text-xs flex items-center gap-3">
                <div className="p-2 rounded bg-rose-500/10 text-rose-400"><Youtube className="w-4 h-4" /></div>
                <div>
                  <div className="font-semibold text-slate-200">Synchronized Video Lectures</div>
                  <div className="text-[11px] text-slate-400">Timestamped transcripts mapped directly to course concepts.</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#070b12] border border-slate-800 text-xs flex items-center gap-3">
                <div className="p-2 rounded bg-purple-500/10 text-purple-400"><Bot className="w-4 h-4" /></div>
                <div>
                  <div className="font-semibold text-slate-200">Context-Aware AI Academic Tutor</div>
                  <div className="text-[11px] text-slate-400">Grounded answers with [Textbook — p.X] and [YouTube — MM:SS] citations.</div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setStep(2)}
                data-testid="onboarding-continue-btn"
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Focus Area Selection */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 id="onboarding-modal-title" className="text-lg font-bold text-white">Select Your Primary Focus</h3>
              <p className="text-xs text-slate-400 mt-1">
                Customize your initial AI tutor prompts and practice quizzes for your field of study.
              </p>
            </div>

            <div className="space-y-2">
              {subjects.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubject(sub)}
                  className={`w-full p-3 rounded-lg border text-left text-xs font-medium flex items-center justify-between transition-all ${
                    selectedSubject === sub
                      ? "bg-indigo-600/20 border-indigo-500 text-white"
                      : "bg-[#070b12] border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span>{sub}</span>
                  {selectedSubject === sub && <Check className="w-4 h-4 text-indigo-400" />}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(1)}
                data-testid="onboarding-step2-back-btn"
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                data-testid="onboarding-step2-continue-btn"
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Ready */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in duration-200 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 id="onboarding-modal-title" className="text-xl font-bold text-white">Your Workspace is Ready</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Open your textbook on the left, watch lectures top-right, and ask your private AI tutor on the bottom-right.
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={handleFinish}
                data-testid="onboarding-complete-btn"
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm"
              >
                Enter Study Workspace
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
