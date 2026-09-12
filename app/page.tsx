"use client";

import React, { useState, useEffect } from "react";
import { Book, StudentProgress, VideoLecture } from "@/types";
import { WorkspaceNavbar } from "@/components/navbar/WorkspaceNavbar";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { StudyDashboard } from "@/components/dashboard/StudyDashboard";
import { LandingPage } from "@/components/landing/LandingPage";
import { QuizModal } from "@/components/modals/QuizModal";
import { FlashcardsModal } from "@/components/modals/FlashcardsModal";
import { ShortcutsModal } from "@/components/modals/ShortcutsModal";
import { DocumentUploadModal } from "@/components/modals/DocumentUploadModal";
import { OnboardingModal } from "@/components/modals/OnboardingModal";
import { CommandPaletteModal } from "@/components/modals/CommandPaletteModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { LibraryModal } from "@/components/library/LibraryModal";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function Home() {
  const [currentView, setCurrentView] = useState<"workspace" | "dashboard" | "landing">("workspace");
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [activePageNumber, setActivePageNumber] = useState<number>(1);
  const [activeVideo, setActiveVideo] = useState<VideoLecture | null>(null);
  const [studentProgress, setStudentProgress] = useState<StudentProgress>({
    streakDays: 0,
    totalStudyMinutes: 0,
    questionsAsked: 0,
    concepts: [],
    quizzesCompleted: 0,
    chaptersCompleted: 0,
    videosWatched: 0,
    activeSubject: "",
    todayPlan: [],
  });

  // Modals state
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState<boolean>(false);
  const [isFlashcardsModalOpen, setIsFlashcardsModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Dynamic Quiz & Flashcards state
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [flashcards, setFlashcards] = useState<any[]>([]);

  // Target citation page jump tracker
  const [targetCitationPage, setTargetCitationPage] = useState<number | null>(null);

  // Load user books on auth
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          fetchUserBooksAndLoadLatest();
          fetchUserProgress();
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
        if (session?.user) {
          fetchUserBooksAndLoadLatest();
          fetchUserProgress();
        } else {
          setActiveBook(null);
          setActiveVideo(null);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Active Study Session Tracker (tracks real study minutes only when browser tab is active)
  useEffect(() => {
    if (!activeBook?.id || currentView !== "workspace") return;

    let elapsedSeconds = 0;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        elapsedSeconds += 15;
        if (elapsedSeconds >= 120) {
          fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookId: activeBook.id,
              durationSeconds: elapsedSeconds,
              pagesRead: 1,
            }),
          }).catch(() => {});
          elapsedSeconds = 0;
        }
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      if (elapsedSeconds >= 30) {
        fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: activeBook.id,
            durationSeconds: elapsedSeconds,
            pagesRead: 1,
          }),
        }).catch(() => {});
      }
    };
  }, [activeBook?.id, currentView]);

  const fetchUserProgress = async () => {
    try {
      const res = await fetch("/api/progress");
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setStudentProgress((prev) => ({
          ...prev,
          totalStudyMinutes: data.totalStudyMinutes || 0,
          streakDays: data.streakDays || 0,
          questionsAsked: data.questionsAsked || 0,
          concepts: data.concepts || [],
        }));
      }
    } catch (err) {
      console.warn("Progress fetch note:", err);
    }
  };

  const fetchUserBooksAndLoadLatest = async () => {
    try {
      const res = await fetch("/api/books");
      const data = await res.json();
      if (res.ok && data.success && data.books?.length > 0) {
        const latestBook = data.books[0];
        handleSelectBook(latestBook.id);
      }
    } catch (err) {
      console.warn("Auto-load book note:", err);
    }
  };

  const handleSelectBook = async (bookId: string) => {
    if (!bookId) return;

    // Reset book-specific context when selecting another book
    setQuizQuestions([]);
    setFlashcards([]);
    setTargetCitationPage(null);

    try {
      const res = await fetch(`/api/books/${bookId}`);
      const data = await res.json();
      if (res.ok && data.success && data.book) {
        setActiveBook(data.book);
        setActivePageNumber(data.lastPageRead || 1);
        if (data.youtubeUrl) {
          const match = data.youtubeUrl.match(
            /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
          );
          if (match) {
            const youtubeId = match[1];
            setActiveVideo({
              id: `vid-${youtubeId}`,
              youtubeId,
              title: data.videoTitle || `Lecture for ${data.book.title}`,
              channelName: data.videoChannel || null,
              durationSeconds: 0,
              formattedDuration: "00:00",
              bookId: data.book.id,
              topics: [],
            });
          } else {
            setActiveVideo(null);
          }
        } else {
          setActiveVideo(null);
        }
        setCurrentView("workspace");
      }
    } catch (err) {
      console.error("Failed to load book:", err);
    }
  };

  // Check first time user for onboarding
  useEffect(() => {
    const hasSeenOnboarding = safeLocalStorageGet("has_seen_onboarding", false);
    if (!hasSeenOnboarding) {
      setIsOnboardingModalOpen(true);
      safeLocalStorageSet("has_seen_onboarding", true);
    }
  }, []);

  // Persist reading position to database when page changes
  useEffect(() => {
    if (activeBook && activeBook.id) {
      const timeout = setTimeout(() => {
        fetch(`/api/books/${activeBook.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastPageRead: activePageNumber }),
        }).catch(() => {});
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [activeBook, activeBook?.id, activePageNumber]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        setActivePageNumber((prev) => Math.max(1, prev - 1));
      } else if (e.key === "ArrowRight") {
        setActivePageNumber((prev) => Math.min(activeBook?.totalPages || 100, prev + 1));
      } else if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        setIsShortcutsModalOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        setCurrentView((prev) => (prev === "dashboard" ? "workspace" : "dashboard"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeBook?.totalPages]);

  const handleOpenQuizModal = async () => {
    setIsQuizModalOpen(true);
    if (activeBook && activeBook.id) {
      const activePageObj = activeBook.pages.find((p) => p.pageNumber === activePageNumber) || activeBook.pages[0];
      try {
        const res = await fetch("/api/quiz/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: activeBook.id,
            pageNumber: activePageNumber,
            contextText: activePageObj?.content || "",
            concept: activePageObj?.sectionTitle || activePageObj?.title || activeBook.title,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.questions?.length > 0) {
          setQuizQuestions(data.questions);
        } else {
          setQuizQuestions([]);
        }
      } catch (err) {
        console.warn("Quiz generation note:", err);
        setQuizQuestions([]);
      }
    } else {
      setQuizQuestions([]);
    }
  };

  const handleOpenFlashcardsModal = async () => {
    setIsFlashcardsModalOpen(true);
    if (activeBook && activeBook.id) {
      const activePageObj = activeBook.pages.find((p) => p.pageNumber === activePageNumber) || activeBook.pages[0];
      try {
        const res = await fetch("/api/flashcards/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: activeBook.id,
            pageNumber: activePageNumber,
            contextText: activePageObj?.content || "",
            concept: activePageObj?.sectionTitle || activePageObj?.title || activeBook.title,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.flashcards?.length > 0) {
          setFlashcards(data.flashcards);
        } else {
          setFlashcards([]);
        }
      } catch (err) {
        console.warn("Flashcards generation note:", err);
        setFlashcards([]);
      }
    } else {
      setFlashcards([]);
    }
  };

  const handleDocumentUploaded = (newBook: Book) => {
    setActiveBook(newBook);
    setActivePageNumber(newBook.pages[0]?.pageNumber || 1);
    setCurrentView("workspace");
  };

  const handleQuizFinish = async (score: number, total: number, concept?: string) => {
    setStudentProgress((prev) => ({
      ...prev,
      quizzesCompleted: prev.quizzesCompleted + 1,
    }));

    try {
      await fetch("/api/quiz/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: activeBook?.id,
          score,
          totalQuestions: total,
          concept: concept || "Core Concept",
          pageNumber: activePageNumber,
          chapterTitle: activeBook?.title || "Textbook Chapter",
        }),
      });
      fetchUserProgress();
    } catch (err) {
      console.warn("Failed to persist quiz attempt:", err);
    }
  };

  const handleCommandPaletteAction = (action: string) => {
    if (action === "quiz") {
      handleOpenQuizModal();
    } else if (action === "flashcards") {
      handleOpenFlashcardsModal();
    } else if (action === "library") {
      setIsLibraryModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased overflow-hidden font-sans">
      {/* Top Navigation */}
      <WorkspaceNavbar
        currentView={currentView}
        onViewChange={setCurrentView}
        activeBook={activeBook}
        activePageNumber={activePageNumber}
        onOpenLibraryModal={() => setIsLibraryModalOpen(true)}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onOpenQuizModal={handleOpenQuizModal}
        onOpenFlashcardsModal={handleOpenFlashcardsModal}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onResetDemo={() => {}}
      />

      {/* Main View Container */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {currentView === "workspace" && (
          activeBook ? (
            <WorkspaceLayout
              book={activeBook}
              activePageNumber={activePageNumber}
              onPageChange={setActivePageNumber}
              video={activeVideo}
              onUpdateVideo={setActiveVideo}
              targetCitationPage={targetCitationPage}
              onClearTargetCitation={() => setTargetCitationPage(null)}
              onLaunchQuiz={handleOpenQuizModal}
              onLaunchFlashcards={handleOpenFlashcardsModal}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center border border-slate-700/50">
                <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Welcome to StudyDock</h2>
                <p className="text-slate-400 max-w-md mx-auto">Upload a textbook to get started. The AI tutor will analyze the material and help you learn faster.</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsUploadModalOpen(true)}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-900/20 font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Textbook
                </button>
                <button
                  onClick={() => setIsLibraryModalOpen(true)}
                  className="bg-slate-900 text-slate-200 border border-slate-800 px-6 py-2.5 rounded-xl hover:bg-slate-800 transition-colors font-medium flex items-center gap-2"
                >
                  Open Library
                </button>
              </div>
            </div>
          )
        )}

        {currentView === "dashboard" && (
          <StudyDashboard
            progress={studentProgress}
            onContinueStudying={(page) => {
              if (page) setActivePageNumber(page);
              setCurrentView("workspace");
            }}
            onLaunchQuiz={handleOpenQuizModal}
            onLaunchFlashcards={handleOpenFlashcardsModal}
          />
        )}

        {currentView === "landing" && (
          <LandingPage
            onStartStudying={() => setCurrentView("workspace")}
            onOpenDashboard={() => setCurrentView("dashboard")}
          />
        )}
      </main>

      {/* Command Palette Modal */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        book={activeBook}
        video={activeVideo}
        onNavigateToPage={(p) => {
          setActivePageNumber(p);
          setCurrentView("workspace");
        }}
        onSelectAction={handleCommandPaletteAction}
      />

      {/* My Academic Library Modal */}
      <LibraryModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        activeBookId={activeBook?.id}
        onSelectBook={handleSelectBook}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
      />

      {/* Interactive Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={() => {
          fetchUserBooksAndLoadLatest();
          fetchUserProgress();
        }}
      />

      <QuizModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        questions={quizQuestions}
        bookTitle={activeBook?.title || "Unknown"}
        pageNumber={activePageNumber}
        onFinishQuiz={handleQuizFinish}
      />

      <FlashcardsModal
        isOpen={isFlashcardsModalOpen}
        onClose={() => setIsFlashcardsModalOpen(false)}
        flashcards={flashcards}
        bookTitle={activeBook?.title || "Unknown"}
        pageNumber={activePageNumber}
      />

      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onDocumentUploaded={handleDocumentUploaded}
      />

      <OnboardingModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        onComplete={() => setCurrentView("workspace")}
      />
    </div>
  );
}
