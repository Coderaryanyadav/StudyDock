"use client";

import React, { useState, useEffect } from "react";
import { Book, StudentProgress, VideoLecture } from "@/types";
import { DEMO_BOOK, DEMO_FLASHCARDS, DEMO_PROGRESS, DEMO_QUIZ_QUESTIONS, DEMO_VIDEO } from "@/lib/demo-data";
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
  const [activeBook, setActiveBook] = useState<Book>(DEMO_BOOK);
  const [activePageNumber, setActivePageNumber] = useState<number>(72);
  const [activeVideo, setActiveVideo] = useState<VideoLecture>(DEMO_VIDEO);
  const [studentProgress, setStudentProgress] = useState<StudentProgress>(DEMO_PROGRESS);

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
  const [quizQuestions, setQuizQuestions] = useState(DEMO_QUIZ_QUESTIONS);
  const [flashcards, setFlashcards] = useState(DEMO_FLASHCARDS);

  // Target citation page jump tracker
  const [targetCitationPage, setTargetCitationPage] = useState<number | null>(null);

  // Load user books on auth
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          fetchUserBooksAndLoadLatest();
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
        if (session?.user) {
          fetchUserBooksAndLoadLatest();
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (bookId.startsWith("demo-") || bookId === DEMO_BOOK.id) {
      setActiveBook(DEMO_BOOK);
      setActivePageNumber(72);
      setActiveVideo(DEMO_VIDEO);
      return;
    }

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
          const youtubeId = match ? match[1] : "7_LPdttKXPc";
          setActiveVideo({
            id: `vid-${youtubeId}`,
            youtubeId,
            title: data.videoTitle || `Lecture for ${data.book.title}`,
            channelName: "Connected Lecture",
            durationSeconds: 3600,
            formattedDuration: "60:00",
            bookId: data.book.id,
            topics: [],
          });
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
    if (activeBook.id && !activeBook.id.startsWith("demo-")) {
      const timeout = setTimeout(() => {
        fetch(`/api/books/${activeBook.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastPageRead: activePageNumber }),
        }).catch(() => {});
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [activeBook.id, activePageNumber]);

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
        setActivePageNumber((prev) => Math.min(activeBook.totalPages || 100, prev + 1));
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
  }, [activeBook.totalPages]);

  const handleOpenQuizModal = async () => {
    setIsQuizModalOpen(true);
    if (activeBook.id && !activeBook.id.startsWith("demo-")) {
      const activePageObj = activeBook.pages.find((p) => p.pageNumber === activePageNumber) || activeBook.pages[0];
      try {
        const res = await fetch("/api/quiz/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: activeBook.id,
            pageNumber: activePageNumber,
            contextText: activePageObj?.content || "",
            concept: activePageObj?.sectionTitle || activeBook.title,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.questions?.length > 0) {
          setQuizQuestions(data.questions);
        }
      } catch (err) {
        console.warn("Quiz generation note:", err);
      }
    } else {
      setQuizQuestions(DEMO_QUIZ_QUESTIONS);
    }
  };

  const handleOpenFlashcardsModal = async () => {
    setIsFlashcardsModalOpen(true);
    if (activeBook.id && !activeBook.id.startsWith("demo-")) {
      const activePageObj = activeBook.pages.find((p) => p.pageNumber === activePageNumber) || activeBook.pages[0];
      try {
        const res = await fetch("/api/flashcards/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: activeBook.id,
            pageNumber: activePageNumber,
            contextText: activePageObj?.content || "",
            concept: activePageObj?.sectionTitle || activeBook.title,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.flashcards?.length > 0) {
          setFlashcards(data.flashcards);
        }
      } catch (err) {
        console.warn("Flashcards generation note:", err);
      }
    } else {
      setFlashcards(DEMO_FLASHCARDS);
    }
  };

  const handleDocumentUploaded = (newBook: Book) => {
    setActiveBook(newBook);
    setActivePageNumber(newBook.pages[0]?.pageNumber || 1);
    setCurrentView("workspace");
  };

  const handleQuizFinish = (score: number, total: number) => {
    setStudentProgress((prev) => ({
      ...prev,
      quizzesCompleted: prev.quizzesCompleted + 1,
    }));
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
        onResetDemo={() => {
          setActiveBook(DEMO_BOOK);
          setActivePageNumber(72);
          setActiveVideo(DEMO_VIDEO);
        }}
      />

      {/* Main View Container */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {currentView === "workspace" && (
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
        activeBookId={activeBook.id}
        onSelectBook={handleSelectBook}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
      />

      {/* Interactive Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={() => {
          fetchUserBooksAndLoadLatest();
        }}
      />

      <QuizModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        questions={quizQuestions}
        bookTitle={activeBook.title}
        pageNumber={activePageNumber}
        onFinishQuiz={handleQuizFinish}
      />

      <FlashcardsModal
        isOpen={isFlashcardsModalOpen}
        onClose={() => setIsFlashcardsModalOpen(false)}
        flashcards={flashcards}
        bookTitle={activeBook.title}
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
