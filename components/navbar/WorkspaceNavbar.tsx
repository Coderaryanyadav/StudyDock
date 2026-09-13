"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  LayoutDashboard,
  Sparkles,
  Search,
  Upload,
  Keyboard,
  Layers,
  HelpCircle,
  ChevronRight,
  User,
  LogOut,
  Library,
  GraduationCap,
  UserPlus,
  LogIn,
} from "lucide-react";
import { Book } from "@/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface WorkspaceNavbarProps {
  currentView: "workspace" | "dashboard" | "landing";
  onViewChange: (view: "workspace" | "dashboard" | "landing") => void;
  activeBook: Book | null;
  activePageNumber: number;
  onOpenLibraryModal: () => void;
  onOpenUploadModal: () => void;
  onOpenShortcutsModal: () => void;
  onOpenQuizModal: () => void;
  onOpenFlashcardsModal: () => void;
  onOpenCommandPalette: () => void;
  onOpenAuthModal: (mode?: "signin" | "signup") => void;
  onResetDemo?: () => void;
  isAuthenticated?: boolean;
}

export const WorkspaceNavbar: React.FC<WorkspaceNavbarProps> = ({
  currentView,
  onViewChange,
  activeBook,
  activePageNumber,
  onOpenLibraryModal,
  onOpenUploadModal,
  onOpenShortcutsModal,
  onOpenQuizModal,
  onOpenFlashcardsModal,
  onOpenCommandPalette,
  onOpenAuthModal,
  isAuthenticated = false,
}) => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const activePageObj = activeBook?.pages?.find((p) => p.pageNumber === activePageNumber);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user?.email) {
          setUserEmail(data.session.user.email);
        } else {
          setUserEmail(null);
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
        setUserEmail(session?.user?.email || null);
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUserEmail(null);
    setShowUserMenu(false);
  };

  const isUserAuthenticated = isAuthenticated || !!userEmail;

  return (
    <header className="h-13 bg-[#0a0e17] border-b border-slate-800/90 px-4 md:px-6 flex items-center justify-between z-30 shrink-0 select-none text-slate-200">
      
      {/* Left: Brand & Breadcrumb */}
      <div className="flex items-center gap-4 overflow-hidden">
        <button
          onClick={() => isUserAuthenticated ? onViewChange("landing") : onOpenAuthModal("signin")}
          aria-label="StudyDock Home"
          className="flex items-center gap-2.5 text-left group shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded-md p-1"
        >
          <div className="w-7 h-7 rounded-md bg-indigo-600 text-white flex items-center justify-center shadow-sm group-hover:bg-indigo-500 transition-colors">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
              StudyDock
            </span>
          </div>
        </button>

        {/* Workspace Active Textbook Breadcrumb (Authenticated Only) */}
        {isUserAuthenticated && currentView === "workspace" && activeBook && (
          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-800 text-xs text-slate-400">
            <span data-testid="nav-active-book-title" className="text-slate-300 font-medium truncate max-w-[160px]">
              {activeBook.title}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="text-slate-300 truncate max-w-[160px]">
              {activePageObj?.sectionTitle || activePageObj?.title || `Page ${activePageNumber}`}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-mono">
              p.{activePageNumber}
            </span>
          </div>
        )}
      </div>

      {/* Center: View Switcher (Authenticated Only) */}
      {isUserAuthenticated ? (
        <nav className="flex items-center bg-[#060910] p-1 rounded-lg border border-slate-800/80 text-xs font-medium" aria-label="Main Navigation">
          <button
            onClick={() => onViewChange("workspace")}
            aria-label="Workspace View"
            data-testid="nav-workspace-btn"
            aria-current={currentView === "workspace" ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              currentView === "workspace"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Workspace</span>
          </button>

          <button
            onClick={() => onViewChange("dashboard")}
            aria-label="Dashboard View"
            data-testid="nav-dashboard-btn"
            aria-current={currentView === "dashboard" ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              currentView === "dashboard"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          <button
            onClick={() => onViewChange("landing")}
            aria-label="Overview View"
            data-testid="nav-overview-btn"
            aria-current={currentView === "landing" ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              currentView === "landing"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </button>
        </nav>
      ) : (
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
          <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
            Private Academic Workspace
          </span>
        </div>
      )}

      {/* Right: Actions, Library & Auth */}
      <div className="flex items-center gap-2">
        {isUserAuthenticated ? (
          <>
            {/* Command Search Shortcut */}
            <button
              onClick={onOpenCommandPalette}
              aria-label="Open Command Palette Search (Cmd+K)"
              data-testid="nav-command-search-btn"
              className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              title="Search anything (⌘K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">
                ⌘K
              </kbd>
            </button>

            {/* Library Modal Trigger */}
            <button
              onClick={onOpenLibraryModal}
              aria-label="Open Academic Library"
              data-testid="nav-library-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              <Library className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">My Library</span>
            </button>

            {/* Import PDF Trigger */}
            <button
              onClick={onOpenUploadModal}
              aria-label="Import Textbook PDF"
              data-testid="nav-import-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import Book</span>
            </button>

            {/* Study Tools (Quiz / Flashcards / Shortcuts) */}
            <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-slate-800 text-slate-400">
              <button
                onClick={onOpenQuizModal}
                aria-label="Open Practice Quiz"
                data-testid="nav-quiz-btn"
                className="p-1.5 rounded-md hover:bg-slate-800 hover:text-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                title="Practice Quiz"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenFlashcardsModal}
                aria-label="Review Study Flashcards"
                data-testid="nav-flashcards-btn"
                className="p-1.5 rounded-md hover:bg-slate-800 hover:text-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                title="Review Flashcards"
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenShortcutsModal}
                aria-label="View Keyboard Shortcuts"
                data-testid="nav-shortcuts-btn"
                className="p-1.5 rounded-md hover:bg-slate-800 hover:text-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                title="Keyboard Shortcuts (?)"
              >
                <Keyboard className="w-4 h-4" />
              </button>
            </div>

            {/* User Profile Menu */}
            <div className="relative pl-1">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-label="User profile menu"
                data-testid="user-profile-menu-btn"
                aria-expanded={showUserMenu}
                className="flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-800 border border-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                <div data-testid="nav-user-email" className="w-6 h-6 rounded bg-indigo-600/30 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                  {userEmail ? userEmail[0].toUpperCase() : "U"}
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-[#0f1624] border border-slate-800 rounded-lg shadow-xl p-2 z-50 text-xs animate-in fade-in">
                  <div className="px-2.5 py-2 border-b border-slate-800/80 mb-1">
                    <div className="text-[10px] text-slate-400">Signed in as</div>
                    <div className="font-semibold text-white truncate" data-testid="user-email-display">{userEmail}</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    aria-label="Sign Out"
                    data-testid="nav-sign-out-btn"
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Unauthenticated State Actions: Sign In & Create Account */
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAuthModal("signin")}
              aria-label="Sign In"
              data-testid="nav-sign-in-btn"
              className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              onClick={() => onOpenAuthModal("signup")}
              aria-label="Create Account"
              data-testid="nav-create-account-btn"
              className="hidden sm:flex px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Create Account</span>
            </button>
          </div>
        )}
      </div>

    </header>
  );
};
