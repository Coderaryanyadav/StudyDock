"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Clock,
  Flame,
  Award,
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Play,
  HelpCircle,
  Layers,
  GraduationCap,
  TrendingUp,
  Brain,
  Check,
  Plus,
} from "lucide-react";
import { ConceptMastery, StudentProgress, StudyPlanItem } from "@/types";

interface StudyDashboardProps {
  progress: StudentProgress;
  onContinueStudying: (page?: number) => void;
  onLaunchQuiz: () => void;
  onLaunchFlashcards: () => void;
}

export const StudyDashboard: React.FC<StudyDashboardProps> = ({
  progress: initialProgress,
  onContinueStudying,
  onLaunchQuiz,
  onLaunchFlashcards,
}) => {
  const [progress, setProgress] = useState<StudentProgress>(initialProgress);
  const [todayPlan, setTodayPlan] = useState<StudyPlanItem[]>(initialProgress.todayPlan || []);
  const [userBooks, setUserBooks] = useState<any[]>([]);

  useEffect(() => {
    // Fetch live progress from database
    fetch("/api/progress")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setProgress((prev) => ({
            ...prev,
            totalStudyMinutes: data.totalStudyMinutes ?? prev.totalStudyMinutes,
            streakDays: data.streakDays ?? prev.streakDays,
            questionsAsked: data.questionsAsked ?? prev.questionsAsked,
            concepts: data.concepts?.length > 0 ? data.concepts : prev.concepts,
          }));
        }
      })
      .catch(() => {});

    // Fetch live user books
    fetch("/api/books")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.books) {
          setUserBooks(data.books);
        }
      })
      .catch(() => {});
  }, []);

  const togglePlanItem = (id: string) => {
    setTodayPlan((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const weakConcepts = (progress.concepts || []).filter((c) => c.isWeak || c.masteryPercentage < 60);
  const activeBook = userBooks[0] || null;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 p-4 md:p-8 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Dashboard Top Hero Greeting */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Academic Dashboard
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Active: {activeBook ? activeBook.subject : progress.activeSubject}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Welcome back, Scholar
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              You are currently on a <strong className="text-amber-400 font-semibold">{progress.streakDays}-day study streak</strong>. Keep up the momentum!
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onContinueStudying(activeBook ? (activeBook.lastPageRead || 1) : 1)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>Continue Studying (p.{activeBook ? (activeBook.lastPageRead || 1) : 1})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weak Concept Warning Alert */}
        {weakConcepts.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-amber-300">
                  Concept Mastery Review Recommended
                </h4>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Your quiz accuracy in <strong>{weakConcepts[0].name}</strong> is currently at <strong>{weakConcepts[0].masteryPercentage}%</strong>. Reviewing {weakConcepts[0].recommendedChapter} will reinforce your understanding.
                </p>
              </div>
            </div>
            <button
              onClick={() => onContinueStudying(weakConcepts[0].recommendedPage)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5"
            >
              <span>Review {weakConcepts[0].name} (p.{weakConcepts[0].recommendedPage})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">
                {Math.floor(progress.totalStudyMinutes / 60)}h {progress.totalStudyMinutes % 60}m
              </div>
              <div className="text-xs text-slate-400">Total Study Time</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-amber-400">
                {progress.streakDays} Days
              </div>
              <div className="text-xs text-slate-400">Active Streak</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">
                {progress.quizzesCompleted}
              </div>
              <div className="text-xs text-slate-400">Quizzes Completed</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-purple-400">
                {progress.questionsAsked}
              </div>
              <div className="text-xs text-slate-400">AI Tutor Queries</div>
            </div>
          </div>
        </div>

        {/* Middle Section: Active Course Card & Today's Study Plan */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Course Card (2 cols) */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">Active Textbook Module</h3>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {activeBook ? `Page ${activeBook.lastPageRead || 1} / ${activeBook.totalPages}` : "No Active Textbook"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-5 items-start">
              <div className="w-full sm:w-44 h-32 rounded-xl bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 border border-slate-700 flex flex-col justify-end p-3 relative overflow-hidden shadow-inner">
                <div className="absolute top-2 right-2 text-[10px] font-mono text-indigo-300/80 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/60">
                  {activeBook ? activeBook.edition || "PDF" : "Library"}
                </div>
                <div className="text-xs font-bold text-white leading-tight line-clamp-2">
                  {activeBook ? activeBook.title : "No textbook currently selected"}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {activeBook ? activeBook.author || "Imported Textbook" : "Upload to get started"}
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <div>
                  <h4 className="font-semibold text-sm text-slate-100">
                    {activeBook ? activeBook.title : "Select or Upload a Textbook"}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeBook ? `Currently on Page ${activeBook.lastPageRead || 1}` : "Ready to study"}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Reading Progress</span>
                    <span className="text-indigo-400 font-semibold">
                      {activeBook ? `${activeBook.lastPageRead || 1} / ${activeBook.totalPages} pages` : "0 / 0 pages"}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: activeBook && activeBook.totalPages ? `${Math.min(100, Math.round(((activeBook.lastPageRead || 1) / activeBook.totalPages) * 100))}%` : "0%",
                      }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                    />
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    onClick={() => onContinueStudying(activeBook ? (activeBook.lastPageRead || 1) : 1)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors flex items-center gap-1.5 shadow-md"
                  >
                    <span>Resume Reading (p.{activeBook ? (activeBook.lastPageRead || 1) : 1})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={onLaunchQuiz}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors flex items-center gap-1.5 border border-slate-700"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Practice Quiz</span>
                  </button>

                  <button
                    onClick={onLaunchFlashcards}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors flex items-center gap-1.5 border border-slate-700"
                  >
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Flashcards</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Today's Study Plan (1 col) */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Today&apos;s Study Plan</h3>
              </div>
              <span className="text-xs text-slate-400">
                {todayPlan.filter((i) => i.completed).length} / {todayPlan.length} done
              </span>
            </div>

            <div className="space-y-2">
              {todayPlan.map((item) => (
                <button
                  key={item.id}
                  onClick={() => togglePlanItem(item.id)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 text-xs ${
                    item.completed
                      ? "bg-slate-950/40 border-slate-800 text-slate-500 line-through"
                      : "bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {item.completed ? (
                      <div className="w-4 h-4 rounded bg-emerald-500 text-slate-950 flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    ) : (
                      <Circle className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <span>{item.target}</span>
                      <span>•</span>
                      <span>~{item.estimatedMinutes} min</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Section: Personalized Concept Mastery Matrix */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-base text-white">Personalized Concept Mastery Matrix</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Calculated from your practice quizzes, textbook notes, and AI query interactions
              </p>
            </div>
            <button
              onClick={onLaunchQuiz}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition-colors"
            >
              Test Mastery
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(progress.concepts || []).map((concept) => (
              <div
                key={concept.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-semibold text-xs text-slate-200">
                      {concept.name}
                    </h5>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {concept.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-bold font-mono ${
                        concept.masteryPercentage >= 80
                          ? "text-emerald-400"
                          : concept.masteryPercentage >= 60
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {concept.masteryPercentage}%
                    </span>
                    <div className="text-[10px] text-slate-500">
                      {concept.questionsCorrect}/{concept.questionsAttempted} correct
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${concept.masteryPercentage}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      concept.masteryPercentage >= 80
                        ? "bg-emerald-500"
                        : concept.masteryPercentage >= 60
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                  />
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-slate-500 truncate max-w-[200px]">
                    {concept.recommendedChapter} (p.{concept.recommendedPage})
                  </span>
                  <button
                    onClick={() => onContinueStudying(concept.recommendedPage)}
                    className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                  >
                    Open Page →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
