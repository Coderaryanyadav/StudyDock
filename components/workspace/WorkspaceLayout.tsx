"use client";

import React, { useState, useEffect, useRef } from "react";
import { Book, LearningMode, VideoLecture, VideoTopic, VideoTranscriptSegment } from "@/types";
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
  onUpdateVideo: (video: VideoLecture | null) => void;
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
  const [topHeight, setTopHeight] = useState<number>(44);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // Load persisted dimensions after mounting on client
  useEffect(() => {
    setIsMounted(true);
    const savedLeft = safeLocalStorageGet("workspace_left_width", 50);
    const savedTop = safeLocalStorageGet("workspace_top_height", 44);
    setLeftWidth(savedLeft);
    setTopHeight(savedTop);
  }, []);

  // Mobile active tab: 'textbook' | 'video' | 'tutor'
  const [mobileTab, setMobileTab] = useState<"textbook" | "video" | "tutor">("textbook");

  // Panel collapsed states
  const [isVideoCollapsed, setIsVideoCollapsed] = useState<boolean>(false);
  const [videoSeekTimestamp, setVideoSeekTimestamp] = useState<number | null>(null);

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

  const handleAskAIAboutVideo = (item: VideoTopic | VideoTranscriptSegment) => {
    const isTopic = "title" in item;
    const promptText = isTopic
      ? `In the lecture at ${item.formattedTime}, the instructor covers "${item.title}". How does this connect to what we read in the textbook on page ${item.pageNumber}?`
      : `In the lecture at timestamp ${item.formattedTime}, the instructor says: "${item.text}". Please explain how this concept relates to our current study material.`;

    setExternalPrompt({
      text: promptText,
      mode: "explain",
    });

    if (isTopic) {
      onPageChange(item.pageNumber);
    }
    setMobileTab("tutor");
  };

  const handleSeekVideoTimestamp = (seconds: number) => {
    setVideoSeekTimestamp(seconds);
    if (mobileTab !== "video") {
      // Keep mobile user in context or notify
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#080c14] select-none">
      {/* Mobile / Small Screen Navigation Tab Bar */}
      <div className="lg:hidden flex items-center justify-around bg-[#0c121e] border-b border-slate-800 p-1 text-xs font-semibold">
        <button
          onClick={() => setMobileTab("textbook")}
          className={`flex items-center gap-1.5 py-2 px-3 rounded-md transition-colors ${
            mobileTab === "textbook"
              ? "bg-indigo-600 text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Textbook (p.{activePageNumber})</span>
        </button>

        <button
          onClick={() => setMobileTab("video")}
          className={`flex items-center gap-1.5 py-2 px-3 rounded-md transition-colors ${
            mobileTab === "video"
              ? "bg-indigo-600 text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Youtube className="w-4 h-4" />
          <span>Lecture</span>
        </button>

        <button
          onClick={() => setMobileTab("tutor")}
          className={`flex items-center gap-1.5 py-2 px-3 rounded-md transition-colors ${
            mobileTab === "tutor"
              ? "bg-indigo-600 text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>AI Tutor</span>
        </button>
      </div>

      {/* Main Responsive Grid Container */}
      <div
        ref={containerRef}
        className="flex-1 flex overflow-hidden relative"
      >
        {/* ========================================================================= */}
        {/* LEFT PANEL: Original PDF / Textbook Reader */}
        {/* ========================================================================= */}
        <div
          style={{ width: isMounted ? `${leftWidth}%` : "50%" }}
          className={`h-full flex flex-col border-r border-slate-800 bg-[#090d16] ${
            mobileTab === "textbook" ? "flex" : "hidden lg:flex"
          } w-full lg:w-auto relative`}
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

        {/* Horizontal Split Resizer Handle (Desktop) */}
        <div
          onMouseDown={() => setIsDraggingH(true)}
          className="hidden lg:flex w-1 bg-slate-800/80 hover:bg-indigo-500 active:bg-indigo-600 cursor-col-resize items-center justify-center transition-colors z-20"
          title="Drag to resize panels"
        >
          <div className="w-1 h-8 rounded bg-slate-600/40" />
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANELS: Top = YouTube Lecture, Bottom = AI Tutor */}
        {/* ========================================================================= */}
        <div
          style={{ width: isMounted ? `${100 - leftWidth}%` : "50%" }}
          className={`h-full flex-col ${
            mobileTab !== "textbook" ? "flex" : "hidden lg:flex"
          } w-full lg:w-auto overflow-hidden bg-[#080c14]`}
        >
          {/* Top-Right: Video Lecture Panel */}
          <div
            style={{
              height: isVideoCollapsed ? "44px" : `${topHeight}%`,
            }}
            className={`w-full border-b border-slate-800 transition-all ${
              mobileTab === "video" ? "flex flex-1" : mobileTab === "tutor" ? "hidden lg:flex" : "flex"
            } overflow-hidden`}
          >
            <VideoPanel
              video={video}
              bookId={book.id}
              activePageNumber={activePageNumber}
              onNavigateToTextbookPage={onPageChange}
              onAskAIAboutVideo={handleAskAIAboutVideo}
              onUpdateVideo={onUpdateVideo}
              seekTimestamp={videoSeekTimestamp}
              isCollapsed={isVideoCollapsed}
              onToggleCollapse={() => setIsVideoCollapsed(!isVideoCollapsed)}
            />
          </div>

          {/* Vertical Split Resizer Handle (Desktop) */}
          {!isVideoCollapsed && (
            <div
              onMouseDown={() => setIsDraggingV(true)}
              className="hidden lg:flex h-1 bg-slate-800/80 hover:bg-indigo-500 active:bg-indigo-600 cursor-row-resize items-center justify-center transition-colors z-20"
              title="Drag to resize video & AI tutor"
            >
              <div className="h-1 w-8 rounded bg-slate-600/40" />
            </div>
          )}

          {/* Bottom-Right: AI Tutor Panel */}
          <div
            style={{
              height: isVideoCollapsed ? "calc(100% - 44px)" : `${100 - topHeight}%`,
            }}
            className={`w-full flex-1 flex flex-col ${
              mobileTab === "tutor" ? "flex" : mobileTab === "video" ? "hidden lg:flex" : "flex"
            } overflow-hidden`}
          >
            <AITutorPanel
              book={book}
              activePageNumber={activePageNumber}
              activeVideo={video}
              onNavigateToTextbookPage={onPageChange}
              onSeekVideoTimestamp={handleSeekVideoTimestamp}
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
