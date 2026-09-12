"use client";

import React, { useState } from "react";
import { X, Sparkles, BookOpen, Youtube, ArrowRight, Check } from "lucide-react";

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

  if (!isOpen) return null;

  const subjects = [
    "Computer Science & Networks",
    "Calculus & Linear Algebra",
    "Physics & Engineering",
    "Biology & Medicine",
    "Economics & Finance",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 text-slate-100 relative">
        {/* Step indicator */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              Step {step} of 3
            </span>
            <span className="text-xs text-slate-400 font-medium">Quick Onboarding</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Welcome & Value Proposition */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">
                Welcome to AI Study Workspace
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                &ldquo;Read it. Watch it. Ask it. Understand it.&rdquo; Everything you need to master difficult university subjects on a single unified screen.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center gap-3">
                <span className="text-lg">📖</span>
                <div>
                  <div className="font-semibold text-slate-200">Digital Textbook Reader</div>
                  <div className="text-[11px] text-slate-400">Highlight, take notes, and jump by section.</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center gap-3">
                <span className="text-lg">🎥</span>
                <div>
                  <div className="font-semibold text-slate-200">Synchronized YouTube Lectures</div>
                  <div className="text-[11px] text-slate-400">Timestamps mapped directly to textbook pages.</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center gap-3">
                <span className="text-lg">🤖</span>
                <div>
                  <div className="font-semibold text-slate-200">Context-Aware AI Academic Tutor</div>
                  <div className="text-[11px] text-slate-400">Provides grounded citations and 10 learning modes.</div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setStep(2)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Choose Subject */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="text-xl font-bold text-white">Choose Primary Subject</h3>
              <p className="text-xs text-slate-400 mt-1">
                Select the topic you are currently preparing for:
              </p>
            </div>

            <div className="space-y-2">
              {subjects.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubject(sub)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all text-xs font-medium flex items-center justify-between ${
                    selectedSubject === sub
                      ? "bg-indigo-950/50 border-indigo-500 text-indigo-200 shadow-sm"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span>{sub}</span>
                  {selectedSubject === sub && <Check className="w-4 h-4 text-indigo-400" />}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <span>Next: Complete Setup</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Launch Workspace */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in duration-200 text-center py-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <Check className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Your Workspace is Ready!</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Your learning workspace is active. Upload your textbook or course materials to start reading with AI citations and synchronized video lectures.
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={() => {
                  onComplete();
                  onClose();
                }}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                <span>Start Studying Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
