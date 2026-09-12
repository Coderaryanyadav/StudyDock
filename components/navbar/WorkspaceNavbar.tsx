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
  Home,
  ChevronRight,
  User,
  LogOut,
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
  onResetDemo,
}) => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
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
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-3 md:px-5 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Left: Brand Logo & Breadcrumbs */}
      <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
        <button
          onClick={() => onViewChange("landing")}
          className="flex items-center gap-2 text-left group"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-900/30 group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-extrabold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
              AI Study Workspace
            </div>
            <div className="text-[10px] text-slate-400 -mt-0.5 font-mono">
              Academic Studio
            </div>
          </div>
        </button>

        {/* Workspace Active Chapter Breadcrumb */}
        {currentView === "workspace" && activeBook && (
          <div className="hidden lg:flex items-center gap-1.5 pl-3 border-l border-slate-800 text-xs text-slate-400">
            <span className="text-slate-300 font-medium truncate max-w-[140px]">
              {activeBook.title}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-slate-300 truncate max-w-[140px]">
              {activePageObj?.sectionTitle || activePageObj?.title || `Page ${activePageNumber}`}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-[10px] font-mono">
              p.{activePageNumber}
            </span>
          </div>
        )}
      </div>

      {/* Center: View Switcher Navigation */}
      <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
        <button
          onClick={() => onViewChange("workspace")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
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
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
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
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
            currentView === "landing"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
          title="Product Landing Page"
        >
          <Home className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: Quick Tools, Auth & Modals */}
      <div className="flex items-center gap-1.5 md:gap-2">
        <button
          onClick={onOpenCommandPalette}
          className="p-1.5 md:px-2.5 md:py-1 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors border border-slate-750 flex items-center gap-1.5 shadow-sm"
          title="Search Workspace (Cmd+K)"
        >
          <Search className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">Search</span>
          <kbd className="hidden md:inline text-[10px] font-mono px-1 rounded bg-slate-950 text-slate-400 border border-slate-700">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={onOpenLibraryModal}
          className="p-1.5 md:px-2.5 md:py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium transition-colors border border-slate-700/60 flex items-center gap-1.5"
          title="My Academic Library"
        >
          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">My Library</span>
        </button>

        <button
          onClick={onOpenUploadModal}
          className="p-1.5 md:px-2.5 md:py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
          title="Upload PDF Textbook"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Import Book</span>
        </button>

        <button
          onClick={onOpenQuizModal}
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs transition-colors border border-slate-700/60"
          title="Practice Quiz"
        >
          <HelpCircle className="w-4 h-4 text-indigo-400" />
        </button>

        <button
          onClick={onOpenFlashcardsModal}
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs transition-colors border border-slate-700/60"
          title="Flashcards Deck"
        >
          <Layers className="w-4 h-4 text-cyan-400" />
        </button>

        <button
          onClick={onOpenShortcutsModal}
          className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Keyboard Shortcuts (?)"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Auth / Account Button */}
        {userEmail ? (
          <div className="flex items-center gap-1.5 pl-1">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-medium"
              title={userEmail}
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden xl:inline max-w-[100px] truncate">{userEmail.split("@")[0]}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="flex items-center gap-1 px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
