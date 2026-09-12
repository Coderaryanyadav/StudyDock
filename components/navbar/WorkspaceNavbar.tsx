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
  onOpenAuthModal: () => void;
  onResetDemo: () => void;
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

  return (
    <header className="h-13 bg-[#0a0e17] border-b border-slate-800/90 px-4 md:px-6 flex items-center justify-between z-30 shrink-0 select-none text-slate-200">
      
      {/* Left: Brand & Breadcrumb */}
      <div className="flex items-center gap-4 overflow-hidden">
        <button
          onClick={() => onViewChange("landing")}
          className="flex items-center gap-2.5 text-left group shrink-0"
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

        {/* Workspace Active Textbook Breadcrumb */}
        {currentView === "workspace" && activeBook && (
          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-800 text-xs text-slate-400">
            <span className="text-slate-300 font-medium truncate max-w-[160px]">
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

      {/* Center: Clean View Switcher Navigation */}
      <nav className="flex items-center bg-[#060910] p-1 rounded-lg border border-slate-800/80 text-xs font-medium">
        <button
          onClick={() => onViewChange("workspace")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
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
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
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
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
            currentView === "landing"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Overview</span>
        </button>
      </nav>

      {/* Right: Actions, Library & Auth */}
      <div className="flex items-center gap-2">
        {/* Command Search Shortcut */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium transition-colors"
        >
          <Library className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">My Library</span>
        </button>

        {/* Import PDF Trigger */}
        <button
          onClick={onOpenUploadModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Import Book</span>
        </button>

        {/* Study Tools (Quiz / Flashcards / Shortcuts) */}
        <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-slate-800 text-slate-400">
          <button
            onClick={onOpenQuizModal}
            className="p-1.5 rounded-md hover:bg-slate-800 hover:text-slate-200 transition-colors"
            title="Practice Quiz"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenFlashcardsModal}
            className="p-1.5 rounded-md hover:bg-slate-800 hover:text-slate-200 transition-colors"
            title="Review Flashcards"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenShortcutsModal}
            className="p-1.5 rounded-md hover:bg-slate-800 hover:text-slate-200 transition-colors"
            title="Keyboard Shortcuts"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>

        {/* Auth / User Profile */}
        <div className="relative pl-1">
          {userEmail ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-800 border border-slate-800 transition-colors"
              >
                <div className="w-6 h-6 rounded bg-indigo-600/30 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                  {userEmail[0].toUpperCase()}
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-[#0f1624] border border-slate-800 rounded-lg shadow-xl p-2 z-50 text-xs animate-in fade-in">
                  <div className="px-2.5 py-2 border-b border-slate-800/80 mb-1">
                    <div className="text-[10px] text-slate-400">Signed in as</div>
                    <div className="font-semibold text-white truncate">{userEmail}</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
