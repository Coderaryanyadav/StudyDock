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
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/utils";

export default function Home() {
  const [currentView, setCurrentView] = useState<"workspace" | "dashboard" | "landing">("workspace");
  const [activeBook, setActiveBook] = useState<Book>(DEMO_BOOK);
  const [activePageNumber, setActivePageNumber] = useState<number>(72); // Default to TCP Handshake Page 72
  const [activeVideo, setActiveVideo] = useState<VideoLecture>(DEMO_VIDEO);
  const [studentProgress, setStudentProgress] = useState<StudentProgress>(DEMO_PROGRESS);

  // Modals state
  const [isQuizModalOpen, setIsQuizModalOpen] = useState<boolean>(false);
  const [isFlashcardsModalOpen, setIsFlashcardsModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Target citation page jump tracker
  const [targetCitationPage, setTargetCitationPage] = useState<number | null>(null);

  // Check first time user for onboarding
  useEffect(() => {
    const hasSeenOnboarding = safeLocalStorageGet("has_seen_onboarding", false);
    if (!hasSeenOnboarding) {
      setIsOnboardingModalOpen(true);
      safeLocalStorageSet("has_seen_onboarding", true);
    }
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      // Arrow navigation
      if (e.key === "ArrowLeft") {
        setActivePageNumber((prev) => Math.max(70, prev - 1));
      } else if (e.key === "ArrowRight") {
        setActivePageNumber((prev) => Math.min(76, prev + 1));
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
  }, []);

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
      setIsQuizModalOpen(true);
    } else if (action === "flashcards") {
      setIsFlashcardsModalOpen(true);
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
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onOpenQuizModal={() => setIsQuizModalOpen(true)}
        onOpenFlashcardsModal={() => setIsFlashcardsModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
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
            onLaunchQuiz={() => setIsQuizModalOpen(true)}
            onLaunchFlashcards={() => setIsFlashcardsModalOpen(true)}
          />
        )}

        {currentView === "dashboard" && (
          <StudyDashboard
            progress={studentProgress}
            onContinueStudying={(page) => {
              if (page) setActivePageNumber(page);
              setCurrentView("workspace");
            }}
            onLaunchQuiz={() => setIsQuizModalOpen(true)}
            onLaunchFlashcards={() => setIsFlashcardsModalOpen(true)}
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

      {/* Interactive Modals */}
      <QuizModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        questions={DEMO_QUIZ_QUESTIONS}
        onFinishQuiz={handleQuizFinish}
      />

      <FlashcardsModal
        isOpen={isFlashcardsModalOpen}
        onClose={() => setIsFlashcardsModalOpen(false)}
        flashcards={DEMO_FLASHCARDS}
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
