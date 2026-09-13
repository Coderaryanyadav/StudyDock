"use client";

import React from "react";
import {
  GraduationCap,
  BookOpen,
  Youtube,
  Bot,
  ShieldCheck,
  ArrowRight,
  UserPlus,
  LogIn,
  CheckCircle2,
} from "lucide-react";

interface UnauthenticatedLandingProps {
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
}

export const UnauthenticatedLanding: React.FC<UnauthenticatedLandingProps> = ({
  onOpenSignIn,
  onOpenSignUp,
}) => {
  return (
    <div className="flex-1 flex flex-col justify-between bg-[#080c14] text-slate-100 overflow-y-auto custom-scrollbar">
      
      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-20 flex flex-col items-center text-center space-y-8 my-auto">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          <GraduationCap className="w-4 h-4" />
          <span>Academic Cloud Study Workspace</span>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="space-y-4 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Learn smarter with <span className="text-indigo-400">StudyDock</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            Read your textbooks, watch lectures, and ask an AI tutor grounded in your study material.
          </p>
        </div>

        {/* Primary Call to Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md pt-2">
          <button
            onClick={onOpenSignIn}
            data-testid="landing-sign-in-btn"
            className="w-full sm:w-auto flex-1 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>

          <button
            onClick={onOpenSignUp}
            data-testid="landing-create-account-btn"
            className="w-full sm:w-auto flex-1 px-6 py-3 rounded-lg bg-[#0f1624] hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 font-semibold text-sm transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            <UserPlus className="w-4 h-4 text-indigo-400" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left w-full pt-8">
          
          <div className="p-4 sm:p-5 rounded-lg bg-[#0c121e] border border-slate-800/90 space-y-2">
            <div className="p-2 w-fit rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <h2 className="font-semibold text-sm text-white">Original Textbook Reader</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Read course textbooks with persistent highlights, notes, bookmarks, and page-accurate navigation.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-lg bg-[#0c121e] border border-slate-800/90 space-y-2">
            <div className="p-2 w-fit rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Youtube className="w-4 h-4" />
            </div>
            <h2 className="font-semibold text-sm text-white">Synchronized Lectures</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Link YouTube course lectures and jump instantly to key concepts with timestamped cross-references.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-lg bg-[#0c121e] border border-slate-800/90 space-y-2">
            <div className="p-2 w-fit rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Bot className="w-4 h-4" />
            </div>
            <h2 className="font-semibold text-sm text-white">Grounded AI Academic Tutor</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ask deep conceptual questions with verified page citations, LaTeX equations, and automated practice quizzes.
            </p>
          </div>

        </div>

        {/* Security & Privacy Assurance */}
        <div className="flex items-center justify-center gap-2 pt-4 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Your study data and textbooks stay completely private.</span>
        </div>

      </div>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-800/60 text-center text-xs text-slate-400">
        <span>StudyDock &copy; {new Date().getFullYear()} — Secure Academic Workspace</span>
      </footer>

    </div>
  );
};
