"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Clock,
  Flame,
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  Layers,
  Brain,
  Check,
  Plus,
  Compass,
  TrendingUp,
  RotateCcw,
  Activity,
  Loader2,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { StudentProgress, StudyPlanItem } from "@/types";

interface StudyDashboardProps {
  progress: StudentProgress;
  onContinueStudying: (page?: number) => void;
  onLaunchQuiz: () => void;
  onLaunchFlashcards: () => void;
  onOpenLibrary?: () => void;
  onOpenUpload?: () => void;
}

export const StudyDashboard: React.FC<StudyDashboardProps> = ({
  progress: initialProgress,
  onContinueStudying,
  onLaunchQuiz,
  onLaunchFlashcards,
  onOpenLibrary,
  onOpenUpload,
}) => {
  const [progress, setProgress] = useState<StudentProgress>(initialProgress);
  const [todayPlan, setTodayPlan] = useState<StudyPlanItem[]>(initialProgress.todayPlan || []);
  const [userBooks, setUserBooks] = useState<any[]>([]);
  const [userName, setUserName] = useState<string>("Scholar");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setFetchError(null);

    try {
      const [progRes, booksRes] = await Promise.all([
        fetch("/api/progress"),
        fetch("/api/books"),
      ]);

      const [progData, booksData] = await Promise.all([
        progRes.json().catch(() => ({})),
        booksRes.json().catch(() => ({})),
      ]);

      if (progRes.ok && progData.authenticated) {
        setProgress({
          totalStudyMinutes: progData.totalStudyMinutes ?? 0,
          totalStudySeconds: progData.totalStudySeconds ?? 0,
          streakDays: progData.streakDays ?? 0,
          longestStreakDays: progData.longestStreakDays ?? 0,
          chaptersCompleted: progData.chaptersCompleted ?? 0,
          totalChapters: progData.totalChapters ?? 0,
          videosWatched: progData.videosWatched ?? 0,
          quizzesCompleted: progData.quizzesCompleted ?? 0,
          questionsAsked: progData.questionsAsked ?? 0,
          flashcardsReviewed: progData.flashcardsReviewed ?? 0,
          pagesRead: progData.pagesRead ?? 0,
          bookProgressPercentage: progData.bookProgressPercentage ?? 0,
          activeSubject: progData.activeSubject || "",
          concepts: progData.concepts || [],
          todayPlan: progData.todayPlan || [],
          recentActivity: progData.recentActivity || [],
        });

        if (progData.todayPlan) {
          setTodayPlan(progData.todayPlan);
        }

        if (progData.user?.displayName || progData.user?.email) {
          setUserName(progData.user.displayName || progData.user.email.split("@")[0]);
        }
      }

      if (booksRes.ok && booksData.success && Array.isArray(booksData.books)) {
        setUserBooks(booksData.books);
      }
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      setFetchError("Unable to load latest study metrics from the database.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const togglePlanItem = (id: string) => {
    setTodayPlan((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const weakConcepts = (progress.concepts || []).filter(
    (c) => (c.isWeak || c.masteryPercentage < 60) && c.questionsAttempted > 0
  );
  const activeBook = userBooks[0] || null;

  const formatStudyTime = (minutes: number) => {
    if (!minutes || minutes <= 0) return "0m";
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (hours === 0) return `${remainingMins}m`;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  };

  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return "";
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#080c14] text-slate-100 p-5 md:p-10 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Error Alert Banner */}
        {fetchError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span className="text-xs font-medium">{fetchError}</span>
            </div>
            <button
              onClick={fetchDashboardData}
              className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Top Header / Welcome Area */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-slate-800/80">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Compass className="w-3.5 h-3.5" />
                Academic Dashboard
              </span>
              {activeBook?.subject && (
                <span className="text-xs text-slate-400 font-mono">
                  • {activeBook.subject}
                </span>
              )}
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Welcome back, {userName}
            </h1>
            
            <p className="text-sm text-slate-400">
              {progress.streakDays > 0 ? (
                <>You are currently on a <strong className="text-amber-400 font-semibold">{progress.streakDays}-day study streak</strong>{progress.longestStreakDays && progress.longestStreakDays > progress.streakDays ? ` (Best: ${progress.longestStreakDays} days)` : ""}. Keep up the focus.</>
              ) : (
                <>Ready for today&apos;s study session? Open your textbook to build your streak.</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeBook ? (
              <button
                onClick={() => onContinueStudying(activeBook.lastPageRead || 1)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-sm active:scale-[0.99]"
              >
                <BookOpen className="w-4 h-4" />
                <span>Continue Studying (p.{activeBook.lastPageRead || 1})</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>
            ) : (
              <button
                onClick={onOpenUpload}
                data-testid="empty-import-btn"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-sm focus-ring"
              >
                <Plus className="w-4 h-4" />
                <span>Import Textbook</span>
              </button>
            )}
          </div>
        </section>

        {/* Weak Concept Recommendation Banner (Derived dynamically from student_concepts) */}
        {weakConcepts.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-amber-300">
                  Targeted Concept Review Recommended
                </h4>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Quiz accuracy in <strong className="text-amber-200 font-semibold">{weakConcepts[0].name}</strong> is currently at <strong className="text-amber-200 font-semibold">{weakConcepts[0].masteryPercentage}%</strong>. Reviewing {weakConcepts[0].recommendedChapter} will solidify this topic.
                </p>
              </div>
            </div>
            <button
              onClick={() => onContinueStudying(weakConcepts[0].recommendedPage)}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>Review (p.{weakConcepts[0].recommendedPage})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 4 Clean Metric Statistics (Derived strictly from database records) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#0f1624] border border-slate-800 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div data-testid="dashboard-study-time" className="text-xl font-bold text-white tracking-tight">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-400" /> : formatStudyTime(progress.totalStudyMinutes)}
              </div>
              <div className="text-xs text-slate-400 font-medium">Total Study Time</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0f1624] border border-slate-800 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div data-testid="dashboard-streak" className="text-xl font-bold text-amber-400 tracking-tight">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-amber-400" /> : `${progress.streakDays} ${progress.streakDays === 1 ? "Day" : "Days"}`}
              </div>
              <div className="text-xs text-slate-400 font-medium">Active Streak</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0f1624] border border-slate-800 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div data-testid="dashboard-quizzes" className="text-xl font-bold text-white tracking-tight">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-emerald-400" /> : progress.quizzesCompleted}
              </div>
              <div className="text-xs text-slate-400 font-medium">Quizzes Completed</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0f1624] border border-slate-800 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div data-testid="dashboard-queries" className="text-xl font-bold text-purple-400 tracking-tight">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-purple-400" /> : progress.questionsAsked}
              </div>
              <div className="text-xs text-slate-400 font-medium">AI Tutor Queries</div>
            </div>
          </div>
        </section>

        {/* Main Grid: Active Textbook & Today's Study Recommendations */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Active Textbook Module (2 cols) */}
          <div className="lg:col-span-2 p-6 rounded-xl bg-[#0f1624] border border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-300">
                  Current Textbook
                </h3>
              </div>
              {activeBook && (
                <div className="flex items-center gap-2">
                  {userBooks.length > 1 && onOpenLibrary && (
                    <button
                      onClick={onOpenLibrary}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 font-medium mr-2"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>{userBooks.length} in Library</span>
                    </button>
                  )}
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {Math.min(100, Math.round(((activeBook.lastPageRead || 1) / Math.max(1, activeBook.totalPages || 1)) * 100))}% Complete
                  </span>
                </div>
              )}
            </div>

            {activeBook ? (
              <div className="space-y-4">
                {/* Processing Incomplete / Failed Status Alerts */}
                {activeBook.status && activeBook.status !== "READY" && (
                  <div className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
                    activeBook.status === "FAILED"
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  }`}>
                    {activeBook.status === "FAILED" ? (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                    )}
                    <span>
                      {activeBook.status === "FAILED"
                        ? `Processing issue: ${activeBook.statusMessage || "Failed to parse document"}`
                        : `Textbook status: ${activeBook.status}. Indexing content for RAG...`}
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  {/* Realistic Book Mockup Spine */}
                  <div className="w-full sm:w-36 h-48 rounded-lg bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-900/40 flex flex-col justify-between p-3.5 relative overflow-hidden shadow-md shrink-0">
                    <div className="flex justify-between items-start">
                      <div className="w-1.5 h-full absolute left-0 top-0 bottom-0 bg-indigo-500/30" />
                      <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800/40">
                        {activeBook.edition || "Academic"}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white line-clamp-3 leading-snug">
                        {activeBook.title}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 truncate">
                        {activeBook.author || "Textbook"}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 w-full">
                    <div>
                      <h4 className="font-bold text-base text-white">
                        {activeBook.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {activeBook.author ? `by ${activeBook.author}` : "Academic Textbook"} • {activeBook.totalPages} Total Pages
                      </p>
                    </div>

                    {/* Reading Progress */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                        <span>Reading Progress</span>
                        <span className="text-indigo-400 font-semibold">
                          Page {activeBook.lastPageRead || 1} of {activeBook.totalPages}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(100, Math.round(((activeBook.lastPageRead || 1) / Math.max(1, activeBook.totalPages)) * 100))}%`,
                          }}
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        />
                      </div>
                    </div>

                    {/* Chapter Progress */}
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-0.5">
                      <span>Chapter Progress</span>
                      <span className="text-emerald-400 font-semibold">
                        {progress.chaptersCompleted} {progress.chaptersCompleted === 1 ? "Chapter" : "Chapters"} Completed{progress.totalChapters ? ` of ${progress.totalChapters}` : ""}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => onContinueStudying(activeBook.lastPageRead || 1)}
                        aria-label={`Resume reading ${activeBook.title} on page ${activeBook.lastPageRead || 1}`}
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Resume Reading (p.{activeBook.lastPageRead || 1})</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={onLaunchQuiz}
                        aria-label="Launch Practice Quiz"
                        className="px-3.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-medium text-xs transition-colors flex items-center gap-1.5 border border-slate-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Practice Quiz</span>
                      </button>

                      <button
                        onClick={onLaunchFlashcards}
                        aria-label="Review Flashcards"
                        className="px-3.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-medium text-xs transition-colors flex items-center gap-1.5 border border-slate-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                      >
                        <Layers className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Flashcards</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center space-y-3 bg-[#0a0e1a] rounded-lg border border-dashed border-slate-800 p-6">
                <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-200">No Active Textbook</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Import your course PDF or select a book from your library to start studying.
                  </p>
                </div>
                <button
                  onClick={onOpenUpload}
                  aria-label="Import Textbook PDF"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Import Textbook PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Today's Study Recommendations (Derived from current progress) */}
          <div className="p-6 rounded-xl bg-[#0f1624] border border-slate-800 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-300">
                    Daily Study Plan
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {todayPlan.filter((i) => i.completed).length}/{todayPlan.length} done
                </span>
              </div>

              {todayPlan.length > 0 ? (
                <div className="space-y-2">
                  {todayPlan.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => togglePlanItem(item.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 text-xs ${
                        item.completed
                          ? "bg-slate-950/40 border-slate-800/60 text-slate-500 line-through"
                          : "bg-slate-950/80 border-slate-800 text-slate-200 hover:border-slate-700"
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
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 font-mono">
                          <span>{item.target}</span>
                          <span>•</span>
                          <span>~{item.estimatedMinutes} min</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs space-y-1">
                  <p>All daily targets completed.</p>
                  <p className="text-[11px]">Keep reading or launch a practice quiz.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px] text-slate-500">Derived from current reading progress</span>
              <span className="font-medium text-emerald-400">Personalized</span>
            </div>
          </div>
        </section>

        {/* Recent Activity Timeline (From real study_events table) */}
        <section className="p-6 rounded-xl bg-[#0f1624] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-300">
                Recent Activity
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Real-time study event feed
            </span>
          </div>

          {progress.recentActivity && progress.recentActivity.length > 0 ? (
            <div className="divide-y divide-slate-800/60">
              {progress.recentActivity.slice(0, 6).map((act, idx) => (
                <div key={act.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                    <span className="text-slate-200 font-medium truncate">{act.title}</span>
                    {act.pageNumber && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">
                        p.{act.pageNumber}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono shrink-0 ml-3">
                    {formatTimeAgo(act.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-slate-500 text-xs">
              No study activity recorded yet. Open a textbook or ask the AI tutor to begin your study session.
            </div>
          )}
        </section>

        {/* Personalized Concept Mastery Matrix (Grounded in student_concepts table) */}
        <section className="p-6 rounded-xl bg-[#0f1624] border border-slate-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-300">
                  Concept Mastery Matrix
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Calculated dynamically from your quiz performance, textbook notes, and AI tutor interactions.
              </p>
            </div>
            
            <button
              onClick={onLaunchQuiz}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-colors self-start sm:self-auto flex items-center gap-1.5"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Test Concept Mastery</span>
            </button>
          </div>

          {progress.concepts && progress.concepts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {progress.concepts.map((concept) => (
                <div
                  key={concept.id}
                  className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-semibold text-sm text-slate-200">
                        {concept.name}
                      </h5>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {concept.category}
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-sm font-bold font-mono ${
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
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${concept.masteryPercentage}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${
                        concept.masteryPercentage >= 80
                          ? "bg-emerald-500"
                          : concept.masteryPercentage >= 60
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-0.5 text-xs">
                    <span className="text-slate-500 truncate max-w-[220px]">
                      {concept.recommendedChapter} (p.{concept.recommendedPage})
                    </span>
                    <button
                      onClick={() => onContinueStudying(concept.recommendedPage)}
                      className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors flex items-center gap-1"
                    >
                      <span>Study</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-slate-500 text-xs space-y-2 bg-slate-950/40 rounded-lg border border-dashed border-slate-800 p-6">
              <Brain className="w-6 h-6 mx-auto text-slate-600" />
              <p className="text-slate-300 font-medium">No Concept Mastery Data Yet</p>
              <p className="text-slate-500 max-w-sm mx-auto text-[11px]">
                Take practice quizzes and ask the AI tutor questions while studying to build your personalized mastery matrix.
              </p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
};
