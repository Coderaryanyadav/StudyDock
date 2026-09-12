"use client";

import React, { useState, useEffect, useRef } from "react";
import { Book, LearningMode, VideoLecture, VideoTopic } from "@/types";
import { TextbookPanel } from "./TextbookPanel";
import { VideoPanel } from "./VideoPanel";
import { AITutorPanel } from "./AITutorPanel";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/utils";
import { BookOpen, Youtube, Bot, GripVertical, GripHorizontal } from "lucide-react";

interface WorkspaceLayoutProps {
  book: Book;
  activePageNumber: number;
  onPageChange: (page: number) => void;
  video: VideoLecture | null;
  onUpdateVideo: (video: VideoLecture) => void;
  targetCitationPage?: number | null;
  onClearTargetCitation?: () => void;
  onLaunchQuiz: () => void;
  onLaunchFlashcards: () => void;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  book,
  activePageNumber,
  onPageChange,
  video,
  onUpdateVideo,
  targetCitationPage,
  onClearTargetCitation,
  onLaunchQuiz,
  onLaunchFlashcards,
}) => {
  // Panel dimensions (% based)
  const [leftWidth, setLeftWidth] = useState<number>(50);
  const [topHeight, setTopHeight] = useState<number>(46);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // Load persisted dimensions after mounting on client
  useEffect(() => {
    setIsMounted(true);
    const savedLeft = safeLocalStorageGet("workspace_left_width", 50);
    const savedTop = safeLocalStorageGet("workspace_top_height", 46);
    setLeftWidth(savedLeft);
    setTopHeight(savedTop);
  }, []);

  // Mobile active tab: 'textbook' | 'video' | 'tutor'
  const [mobileTab, setMobileTab] = useState<"textbook" | "video" | "tutor">("textbook");

  // Panel collapsed states
  const [isTextbookCollapsed, setIsTextbookCollapsed] = useState<boolean>(false);
  const [isVideoCollapsed, setIsVideoCollapsed] = useState<boolean>(false);
  const [isTutorCollapsed, setIsTutorCollapsed] = useState<boolean>(false);

  // External prompt bridge for AI Tutor
  const [externalPrompt, setExternalPrompt] = useState<{
    text: string;
    mode?: LearningMode;
    selectedText?: string;
  } | null>(null);

  // Dragging state
  const [isDraggingH, setIsDraggingH] = useState<boolean>(false);
  const [isDraggingV, setIsDraggingV] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist divider positions
  useEffect(() => {
    safeLocalStorageSet("workspace_left_width", leftWidth);
  }, [leftWidth]);

  useEffect(() => {
    safeLocalStorageSet("workspace_top_height", topHeight);
  }, [topHeight]);

  // Horizontal mouse move handler (left/right split)
  useEffect(() => {
    const handleMouseMoveH = (e: MouseEvent) => {
      if (!isDraggingH || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(75, Math.max(25, newLeftWidth)));
    };

    const handleMouseUpH = () => {
      setIsDraggingH(false);
    };

    if (isDraggingH) {
      window.addEventListener("mousemove", handleMouseMoveH);
      window.addEventListener("mouseup", handleMouseUpH);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMoveH);
      window.removeEventListener("mouseup", handleMouseUpH);
    };
  }, [isDraggingH]);

  // Vertical mouse move handler (top/bottom split on right side)
  useEffect(() => {
    const handleMouseMoveV = (e: MouseEvent) => {
      if (!isDraggingV || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newTopHeight = ((e.clientY - rect.top) / rect.height) * 100;
      setTopHeight(Math.min(75, Math.max(25, newTopHeight)));
    };

    const handleMouseUpV = () => {
      setIsDraggingV(false);
    };

    if (isDraggingV) {
      window.addEventListener("mousemove", handleMouseMoveV);
      window.addEventListener("mouseup", handleMouseUpV);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMoveV);
      window.removeEventListener("mouseup", handleMouseUpV);
    };
  }, [isDraggingV]);

  // Handlers for cross-panel interactions
  const handleAskAIWithSelection = (text: string, mode?: LearningMode) => {
    let promptText = `Explain this textbook passage from page ${activePageNumber}: "${text}"`;
    if (mode === "beginner") {
      promptText = `Explain this passage in simple terms with a beginner analogy: "${text}"`;
    } else if (mode === "example") {
      promptText = `Provide a real-world example illustrating this concept: "${text}"`;
    } else if (mode === "quiz") {
      promptText = `Give me a practice quiz question on this passage: "${text}"`;
    } else if (mode === "flashcards") {
      promptText = `Generate study flashcards for this concept: "${text}"`;
    }

    setExternalPrompt({
      text: promptText,
      mode,
      selectedText: text,
    });

    // On mobile switch to tutor tab automatically
    setMobileTab("tutor");
  };

  const handleAskAIAboutVideo = (topic: VideoTopic) => {
    setExternalPrompt({
      text: `In the lecture at ${topic.formattedTime}, the instructor covers "${topic.title}". How does this connect to what we read in the textbook on page ${topic.pageNumber}?`,
      mode: "explain",
    });
    setMobileTab("tutor");
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-950">
      {/* Mobile Tab Navigation (< md screens) */}
      <div className="md:hidden flex items-center justify-around bg-slate-900 border-b border-slate-800 py-1.5 px-2 shrink-0 z-20">
        <button
          onClick={() => setMobileTab("textbook")}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-medium transition-all ${
            mobileTab === "textbook"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>📚 Textbook</span>
        </button>

        <button
          onClick={() => setMobileTab("video")}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-medium transition-all ${
            mobileTab === "video"
              ? "bg-red-600 text-white shadow-md shadow-red-900/40"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Youtube className="w-3.5 h-3.5" />
          <span>🎥 Video</span>
        </button>

        <button
          onClick={() => setMobileTab("tutor")}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-medium transition-all ${
            mobileTab === "tutor"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>🤖 AI Tutor</span>
        </button>
      </div>

      {/* Main Container */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
        {/* ========================================================================= */}
        {/* LEFT PANEL: Digital Textbook Reader                                      */}
        {/* ========================================================================= */}
        <div
          style={{
            width: typeof window !== "undefined" && window.innerWidth < 768 ? "100%" : `${leftWidth}%`,
          }}
          className={`h-full flex flex-col transition-all duration-75 ${
            mobileTab === "textbook" ? "flex" : "hidden md:flex"
          }`}
        >
          <TextbookPanel
            book={book}
            activePageNumber={activePageNumber}
            onPageChange={onPageChange}
            onAskAIWithSelection={handleAskAIWithSelection}
            targetCitationPage={targetCitationPage}
            onClearTargetCitation={onClearTargetCitation}
          />
        </div>

        {/* ========================================================================= */}
        {/* RESIZABLE DIVIDER (Horizontal between Left and Right)                     */}
        {/* ========================================================================= */}
        <div
          onMouseDown={() => setIsDraggingH(true)}
          className={`hidden md:flex w-1.5 hover:w-2 bg-slate-900 hover:bg-indigo-500/80 cursor-col-resize items-center justify-center transition-colors group z-20 select-none ${
            isDraggingH ? "bg-indigo-600 w-2" : ""
          }`}
          title="Drag to resize textbook panel"
        >
          <GripVertical className="w-3 h-3 text-slate-600 group-hover:text-white" />
        </div>

        {/* ========================================================================= */}
        {/* RIGHT AREA: Top Video + Bottom AI Tutor                                   */}
        {/* ========================================================================= */}
        <div
          style={{
            width: typeof window !== "undefined" && window.innerWidth < 768 ? "100%" : `${100 - leftWidth}%`,
          }}
          className={`h-full flex flex-col overflow-hidden ${
            mobileTab !== "textbook" ? "flex" : "hidden md:flex"
          }`}
        >
          {/* TOP RIGHT: Video Lecture Panel */}
          <div
            style={{
              height:
                typeof window !== "undefined" && window.innerWidth < 768
                  ? "100%"
                  : isVideoCollapsed
                  ? "44px"
                  : `${topHeight}%`,
            }}
            className={`flex flex-col overflow-hidden transition-all duration-150 ${
              mobileTab === "video" ? "flex" : mobileTab === "tutor" ? "hidden md:flex" : "flex"
            }`}
          >
            <VideoPanel
              video={video}
              bookId={book.id}
              activePageNumber={activePageNumber}
              onNavigateToTextbookPage={(p) => {
                onPageChange(p);
                setMobileTab("textbook");
              }}
              onAskAIAboutVideo={handleAskAIAboutVideo}
              onUpdateVideo={onUpdateVideo}
              isCollapsed={isVideoCollapsed}
              onToggleCollapse={() => setIsVideoCollapsed(!isVideoCollapsed)}
            />
          </div>

          {/* RESIZABLE DIVIDER (Vertical between Video and AI Tutor) */}
          {!isVideoCollapsed && (
            <div
              onMouseDown={() => setIsDraggingV(true)}
              className={`hidden md:flex h-1.5 hover:h-2 bg-slate-900 hover:bg-indigo-500/80 cursor-row-resize items-center justify-center transition-colors group z-20 select-none ${
                isDraggingV ? "bg-indigo-600 h-2" : ""
              }`}
              title="Drag to resize video and tutor panels"
            >
              <GripHorizontal className="w-3 h-3 text-slate-600 group-hover:text-white" />
            </div>
          )}

          {/* BOTTOM RIGHT: AI Tutor Panel */}
          <div
            style={{
              height:
                typeof window !== "undefined" && window.innerWidth < 768
                  ? "100%"
                  : isVideoCollapsed
                  ? "calc(100% - 44px)"
                  : `${100 - topHeight}%`,
            }}
            className={`flex-1 flex flex-col overflow-hidden transition-all duration-150 ${
              mobileTab === "tutor" ? "flex" : mobileTab === "video" ? "hidden md:flex" : "flex"
            }`}
          >
            <AITutorPanel
              book={book}
              activePageNumber={activePageNumber}
              activeVideo={video}
              onNavigateToTextbookPage={(p) => {
                onPageChange(p);
                setMobileTab("textbook");
              }}
              externalPrompt={externalPrompt}
              onClearExternalPrompt={() => setExternalPrompt(null)}
              onLaunchQuizFromAI={onLaunchQuiz}
              onLaunchFlashcardsFromAI={onLaunchFlashcards}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
