"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Book, StudentProgress, VideoLecture } from "@/types";
import { BookOpen, Upload, Loader2, GraduationCap } from "lucide-react";
import { WorkspaceNavbar } from "@/components/navbar/WorkspaceNavbar";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { StudyDashboard } from "@/components/dashboard/StudyDashboard";
import { LandingPage } from "@/components/landing/LandingPage";
import { UnauthenticatedLanding } from "@/components/auth/UnauthenticatedLanding";
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
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
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
  const [authModalInitialMode, setAuthModalInitialMode] = useState<"signin" | "signup">("signin");

  // Dynamic Quiz & Flashcards state
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [flashcards, setFlashcards] = useState<any[]>([]);

  // Target citation page jump tracker
  const [targetCitationPage, setTargetCitationPage] = useState<number | null>(null);

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

  const fetchUserProgress = async () => {
    try {
      const res = await fetch("/api/progress");
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setStudentProgress((prev) => ({
          ...prev,
          totalStudyMinutes: data.totalStudyMinutes || 0,
          totalStudySeconds: data.totalStudySeconds || 0,
          streakDays: data.streakDays || 0,
          longestStreakDays: data.longestStreakDays || 0,
          chaptersCompleted: data.chaptersCompleted || 0,
          videosWatched: data.videosWatched || 0,
          quizzesCompleted: data.quizzesCompleted || 0,
          questionsAsked: data.questionsAsked || 0,
          flashcardsReviewed: data.flashcardsReviewed || 0,
          pagesRead: data.pagesRead || 0,
          bookProgressPercentage: data.bookProgressPercentage || 0,
          activeSubject: data.activeSubject || prev.activeSubject,
          concepts: data.concepts || [],
          todayPlan: data.todayPlan || [],
          recentActivity: data.recentActivity || [],
        }));
      }
    } catch (err) {
      console.warn("Progress fetch note:", err);
    }
  };

  // Real Supabase Session Lifecycle Listener
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthState("unauthenticated");
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!error && data?.session?.user) {
        setAuthState("authenticated");
        fetchUserBooksAndLoadLatest();
        fetchUserProgress();
      } else {
        setAuthState("unauthenticated");
      }
    }).catch(() => {
      setAuthState("unauthenticated");
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setAuthState("authenticated");
        fetchUserBooksAndLoadLatest();
        fetchUserProgress();
      } else {
        setAuthState("unauthenticated");
        setActiveBook(null);
        setActiveVideo(null);
        setQuizQuestions([]);
        setFlashcards([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Active Study Session & Page Tracking (tracks real study time only when tab is visible)
  useEffect(() => {
    if (authState !== "authenticated" || !activeBook?.id || currentView !== "workspace") return;

    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "page_opened",
        bookId: activeBook.id,
        pageNumber: activePageNumber,
      }),
    }).catch(() => {});

    let secondsOnPage = 0;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        secondsOnPage += 15;
        if (secondsOnPage >= 60) {
          fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookId: activeBook.id,
              durationSeconds: secondsOnPage,
              pageNumber: activePageNumber,
            }),
          }).catch(() => {});
          secondsOnPage = 0;
        }
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      if (secondsOnPage >= 15) {
        fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: activeBook.id,
            durationSeconds: secondsOnPage,
            pageNumber: activePageNumber,
          }),
        }).catch(() => {});

        if (secondsOnPage >= 45) {
          fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventType: "page_completed",
              bookId: activeBook.id,
              pageNumber: activePageNumber,
              durationSeconds: secondsOnPage,
            }),
          }).catch(() => {});
        }
      }
    };
  }, [authState, activeBook?.id, activePageNumber, currentView]);

  useEffect(() => {
    if (authState === "authenticated" && currentView === "dashboard") {
      fetchUserProgress();
    }
  }, [authState, currentView]);

  const handleSelectBook = async (bookId: string) => {
    if (!bookId) return;

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

  // Check first time user for onboarding (authenticated only)
  useEffect(() => {
    if (authState === "authenticated") {
      const hasSeenOnboarding = safeLocalStorageGet("has_seen_onboarding", false);
      if (!hasSeenOnboarding) {
        setIsOnboardingModalOpen(true);
      }
    }
  }, [authState]);

  const handlePageChange = useCallback((newPage: number) => {
    setActivePageNumber(newPage);
    if (activeBook?.id) {
      fetch(`/api/books/${activeBook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastPageRead: newPage }),
      }).catch(() => {});
    }
  }, [activeBook?.id]);

  // Global Keyboard Shortcuts (authenticated only)
  useEffect(() => {
    if (authState !== "authenticated") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        handlePageChange(Math.max(1, activePageNumber - 1));
      } else if (e.key === "ArrowRight") {
        handlePageChange(Math.min(activeBook?.totalPages || 100, activePageNumber + 1));
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
  }, [authState, activeBook?.totalPages, activePageNumber, handlePageChange]);

  const handleOpenAuth = (mode: "signin" | "signup" = "signin") => {
    setAuthModalInitialMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleOpenQuizModal = async () => {
    if (authState !== "authenticated") {
      handleOpenAuth("signin");
      return;
    }
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
          setActiveQuizId(data.quizId || null);
          setQuizQuestions(data.questions);
        } else {
          setActiveQuizId(null);
          setQuizQuestions([]);
        }
      } catch (err) {
        console.warn("Quiz generation note:", err);
        setActiveQuizId(null);
        setQuizQuestions([]);
      }
    } else {
      setActiveQuizId(null);
      setQuizQuestions([]);
    }
  };

  const handleOpenFlashcardsModal = async () => {
    if (authState !== "authenticated") {
      handleOpenAuth("signin");
      return;
    }
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

  const handleQuizFinish = async (data: {
    quizId?: string | null;
    answers: { questionId: string; selectedOptionId: string }[];
    startedAt: string;
    completedAt: string;
    timeSpentSeconds: number;
    concept?: string;
  }) => {
    if (!data.quizId) return;

    try {
      const res = await fetch("/api/quiz/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: data.quizId,
          bookId: activeBook?.id,
          answers: data.answers,
          startedAt: data.startedAt,
          completedAt: data.completedAt,
          timeSpentSeconds: data.timeSpentSeconds,
          concept: data.concept || "Core Concept",
          pageNumber: activePageNumber,
          chapterTitle: activeBook?.title || "Textbook Chapter",
        }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setStudentProgress((prev) => ({
          ...prev,
          quizzesCompleted: prev.quizzesCompleted + 1,
        }));
        fetchUserProgress();
      }
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

  // 1. Sleek Loading State while session is determining (prevents any auth flicker)
  if (authState === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080c14] text-slate-100 antialiased font-sans">
        <div className="flex flex-col items-center space-y-4 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            <span>Initializing StudyDock session...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State (STATE A) — Dedicated Professional Welcome / Login Screen
  if (authState === "unauthenticated") {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased overflow-hidden font-sans">
        <WorkspaceNavbar
          currentView="landing"
          onViewChange={() => {}}
          activeBook={null}
          activePageNumber={1}
          onOpenLibraryModal={() => handleOpenAuth("signin")}
          onOpenUploadModal={() => handleOpenAuth("signin")}
          onOpenShortcutsModal={() => {}}
          onOpenQuizModal={() => handleOpenAuth("signin")}
          onOpenFlashcardsModal={() => handleOpenAuth("signin")}
          onOpenCommandPalette={() => handleOpenAuth("signin")}
          onOpenAuthModal={(mode) => handleOpenAuth(mode || "signin")}
          isAuthenticated={false}
        />

        <main className="flex-1 flex flex-col overflow-hidden relative">
          <UnauthenticatedLanding
            onOpenSignIn={() => handleOpenAuth("signin")}
            onOpenSignUp={() => handleOpenAuth("signup")}
          />
        </main>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialMode={authModalInitialMode}
          onAuthSuccess={() => {
            setAuthState("authenticated");
            fetchUserBooksAndLoadLatest();
            fetchUserProgress();
          }}
        />
      </div>
    );
  }

  // 3. Authenticated State (STATE B) — Normal Existing StudyDock Application
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
        onOpenAuthModal={(mode) => handleOpenAuth(mode || "signin")}
        isAuthenticated={true}
      />

      {/* Main View Container */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {currentView === "workspace" && (
          activeBook ? (
            <WorkspaceLayout
              book={activeBook}
              activePageNumber={activePageNumber}
              onPageChange={handlePageChange}
              video={activeVideo}
              onUpdateVideo={setActiveVideo}
              targetCitationPage={targetCitationPage}
              onClearTargetCitation={() => setTargetCitationPage(null)}
              onLaunchQuiz={handleOpenQuizModal}
              onLaunchFlashcards={handleOpenFlashcardsModal}
            />
          ) : (
            <div data-testid="empty-library-upload-prompt" className="flex flex-col items-center justify-center h-full p-6 text-center space-y-5 bg-[#080c14]">
              <div className="w-16 h-16 bg-[#0f1624] rounded-xl flex items-center justify-center border border-slate-800 text-indigo-400">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md">
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Welcome to StudyDock</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Import your course textbook PDF to read, watch synchronized lectures, and study with an AI tutor grounded in your exact page numbers.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button 
                  onClick={() => setIsUploadModalOpen(true)}
                  data-testid="empty-import-btn"
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-500 transition-colors shadow-sm font-semibold text-xs flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import Textbook PDF</span>
                </button>
                <button
                  onClick={() => setIsLibraryModalOpen(true)}
                  data-testid="empty-library-btn"
                  className="bg-[#0f1624] text-slate-200 border border-slate-800 px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-colors font-medium text-xs flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>Open Library</span>
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
            onOpenLibrary={() => setIsLibraryModalOpen(true)}
            onOpenUpload={() => setIsUploadModalOpen(true)}
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
        initialMode={authModalInitialMode}
        onAuthSuccess={() => {
          fetchUserBooksAndLoadLatest();
          fetchUserProgress();
        }}
      />

      <QuizModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        quizId={activeQuizId}
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
        onClose={() => {
          safeLocalStorageSet("has_seen_onboarding", true);
          setIsOnboardingModalOpen(false);
        }}
        onComplete={() => {
          safeLocalStorageSet("has_seen_onboarding", true);
          setIsOnboardingModalOpen(false);
          setCurrentView("workspace");
        }}
      />
    </div>
  );
}
