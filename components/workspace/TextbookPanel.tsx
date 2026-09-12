"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Search,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Highlighter,
  ListTree,
  X,
  FileText,
  Sparkles,
  Layers,
  HelpCircle,
  Copy,
  Check,
} from "lucide-react";
import { Book, BookPage, Highlight, LearningMode } from "@/types";
import { TextbookSelectionToolbar } from "./TextbookSelectionToolbar";
import { renderMathInText } from "@/lib/katex-renderer";

interface TextbookPanelProps {
  book: Book;
  activePageNumber: number;
  onPageChange: (page: number) => void;
  onAskAIWithSelection: (text: string, mode?: LearningMode) => void;
  targetCitationPage?: number | null;
  onClearTargetCitation?: () => void;
}

export const TextbookPanel: React.FC<TextbookPanelProps> = ({
  book,
  activePageNumber,
  onPageChange,
  onAskAIWithSelection,
  targetCitationPage,
  onClearTargetCitation,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showToc, setShowToc] = useState<boolean>(false);
  const [showBookmarks, setShowBookmarks] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [bookmarks, setBookmarks] = useState<number[]>([72]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<"yellow" | "green" | "blue" | "pink">("yellow");
  const [selectionToolbarPos, setSelectionToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const contentRef = useRef<HTMLDivElement>(null);

  // Reset scroll position to top when page changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activePageNumber]);

  // Jump to page if targetCitationPage is triggered
  useEffect(() => {
    if (targetCitationPage && targetCitationPage !== activePageNumber) {
      onPageChange(targetCitationPage);
      if (onClearTargetCitation) onClearTargetCitation();
    }
  }, [targetCitationPage, activePageNumber, onPageChange, onClearTargetCitation]);

  // Current page data
  const currentPage: BookPage =
    book.pages.find((p) => p.pageNumber === activePageNumber) ||
    book.pages[0] || {
      pageNumber: activePageNumber,
      chapterId: "ch-3",
      chapterTitle: "Chapter 3: Transport Layer",
      sectionId: "sec-3-3",
      sectionTitle: "3.3 TCP Three-Way Handshake",
      title: `Page ${activePageNumber}`,
      content: "Content loading...",
    };

  // Handle text selection in textbook
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionToolbarPos(null);
      setSelectedText("");
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 3) {
      setSelectedText(text);
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionToolbarPos({
        x: rect.left + rect.width / 2 - 100,
        y: rect.top - 10,
      });
    } else {
      setSelectionToolbarPos(null);
      setSelectedText("");
    }
  };

  const handleSelectionAction = (
    action: "explain" | "simplify" | "example" | "ask" | "flashcard" | "quiz",
    mode?: LearningMode
  ) => {
    if (!selectedText) return;
    onAskAIWithSelection(selectedText, mode || (action as LearningMode));
    setSelectionToolbarPos(null);
    window.getSelection()?.removeAllRanges();
  };

  const toggleBookmark = () => {
    if (bookmarks.includes(activePageNumber)) {
      setBookmarks(bookmarks.filter((p) => p !== activePageNumber));
    } else {
      setBookmarks([...bookmarks, activePageNumber]);
    }
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(175, Math.max(75, prev + delta)));
  };

  // Search matches
  const searchResults = searchQuery.trim()
    ? book.pages.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 border-r border-slate-800/80 select-text overflow-hidden relative">
      {/* Textbook Header Controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 backdrop-blur-sm z-20">
        {/* Left: TOC & Bookmarks buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setShowToc(!showToc);
              setShowBookmarks(false);
            }}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              showToc
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title="Table of Contents"
          >
            <ListTree className="w-4 h-4" />
            <span className="hidden md:inline">Contents</span>
          </button>

          <button
            onClick={() => {
              setShowBookmarks(!showBookmarks);
              setShowToc(false);
            }}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              showBookmarks
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title="Bookmarks"
          >
            <Bookmark className="w-4 h-4" />
            <span className="hidden md:inline">({bookmarks.length})</span>
          </button>
        </div>

        {/* Center: Chapter info & Page Navigator */}
        <div className="flex items-center gap-2 text-xs">
          <button
            disabled={activePageNumber <= 1}
            onClick={() => onPageChange(activePageNumber - 1)}
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300"
            title="Previous Page (Left Arrow)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            <span className="text-indigo-400 font-semibold">{activePageNumber}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{book.totalPages || book.pages.length || 1}</span>
          </div>

          <button
            disabled={activePageNumber >= (book.totalPages || book.pages.length || 1)}
            onClick={() => onPageChange(activePageNumber + 1)}
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300"
            title="Next Page (Right Arrow)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Search, Zoom, Bookmark Toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsSearching(!isSearching)}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              isSearching
                ? "bg-indigo-600/30 text-indigo-300"
                : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title="Search in Textbook (Cmd+F)"
          >
            <Search className="w-4 h-4" />
          </button>

          <div className="hidden sm:flex items-center gap-0.5 bg-slate-950/80 rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => handleZoom(-15)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-slate-400 font-mono px-1">
              {zoomLevel}%
            </span>
            <button
              onClick={() => handleZoom(15)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={toggleBookmark}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              bookmarks.includes(activePageNumber)
                ? "text-amber-400 hover:text-amber-300"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title={bookmarks.includes(activePageNumber) ? "Remove Bookmark" : "Bookmark this Page"}
          >
            {bookmarks.includes(activePageNumber) ? (
              <BookmarkCheck className="w-4 h-4 text-amber-400" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Search Input Bar (Expandable) */}
      {isSearching && (
        <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2 animate-in slide-in-from-top-2 duration-150">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search within textbook (e.g. handshake, rwnd, AIMD, subnet)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full bg-slate-950 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Search Results Dropdown Overlay */}
      {isSearching && searchQuery.trim().length > 0 && (
        <div className="bg-slate-900/95 border-b border-slate-800 max-h-48 overflow-y-auto px-3 py-2 text-xs divide-y divide-slate-800/60 z-20 shadow-lg">
          <div className="text-[11px] font-semibold text-slate-400 mb-1">
            Found {searchResults.length} matching page(s):
          </div>
          {searchResults.length === 0 ? (
            <div className="text-slate-500 py-1 italic">No matches found.</div>
          ) : (
            searchResults.map((p) => (
              <button
                key={p.pageNumber}
                onClick={() => {
                  onPageChange(p.pageNumber);
                  setIsSearching(false);
                }}
                className="w-full text-left py-1.5 px-2 hover:bg-slate-800 rounded transition-colors flex items-center justify-between text-slate-300 hover:text-indigo-300"
              >
                <div className="truncate font-medium">
                  Page {p.pageNumber}: {p.title}
                </div>
                <span className="text-[10px] text-slate-500 ml-2">Jump →</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Main Workspace Container with TOC Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Table of Contents Drawer */}
        {showToc && (
          <div className="w-64 bg-slate-900 border-r border-slate-800 h-full overflow-y-auto p-3 text-xs z-10 flex flex-col shrink-0 animate-in slide-in-from-left duration-150">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <ListTree className="w-4 h-4 text-indigo-400" /> Table of Contents
              </span>
              <button
                onClick={() => setShowToc(false)}
                className="text-slate-400 hover:text-slate-200 p-0.5 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {book.chapters.map((ch) => (
                <div key={ch.id} className="space-y-1">
                  <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                    Ch {ch.number}: {ch.title}
                  </div>
                  <div className="space-y-0.5 pl-2 border-l border-slate-800">
                    {ch.sections.map((sec) => (
                      <button
                        key={sec.id}
                        onClick={() => {
                          onPageChange(sec.page);
                          setShowToc(false);
                        }}
                        className={`w-full text-left py-1 px-1.5 rounded transition-colors text-[11px] flex items-center justify-between ${
                          activePageNumber === sec.page
                            ? "bg-indigo-600/30 text-indigo-300 font-medium"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        }`}
                      >
                        <span className="truncate">{sec.title}</span>
                        <span className="text-[10px] font-mono text-slate-500 ml-1">
                          p.{sec.page}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bookmarks Drawer */}
        {showBookmarks && (
          <div className="w-64 bg-slate-900 border-r border-slate-800 h-full overflow-y-auto p-3 text-xs z-10 flex flex-col shrink-0 animate-in slide-in-from-left duration-150">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
              <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                <Bookmark className="w-4 h-4" /> Saved Bookmarks
              </span>
              <button
                onClick={() => setShowBookmarks(false)}
                className="text-slate-400 hover:text-slate-200 p-0.5 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {bookmarks.length === 0 ? (
                <div className="text-slate-500 italic py-2">No bookmarks saved yet.</div>
              ) : (
                bookmarks.map((pNum) => {
                  const pageItem = book.pages.find((p) => p.pageNumber === pNum);
                  return (
                    <button
                      key={pNum}
                      onClick={() => {
                        onPageChange(pNum);
                        setShowBookmarks(false);
                      }}
                      className="w-full text-left py-1.5 px-2 rounded hover:bg-slate-800 text-slate-300 hover:text-amber-300 transition-colors flex items-center justify-between"
                    >
                      <span className="truncate font-medium">
                        Page {pNum}: {pageItem?.title || "Book Page"}
                      </span>
                      <span className="text-[10px] text-amber-500 font-mono">Jump</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Digital Textbook Reading Canvas */}
        <div
          ref={contentRef}
          onMouseUp={handleMouseUp}
          className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 flex justify-center bg-slate-950/60 custom-scrollbar"
        >
          {/* Floating Context Toolbar */}
          <TextbookSelectionToolbar
            position={selectionToolbarPos}
            selectedText={selectedText}
            onAction={handleSelectionAction}
            onClose={() => setSelectionToolbarPos(null)}
          />

          {/* Textbook Sheet (Realistic Academic Paper feel) */}
          <div
            style={{
              zoom: `${zoomLevel}%`,
            }}
            className="w-full max-w-3xl bg-slate-900 border border-slate-800/90 rounded-2xl shadow-2xl shadow-slate-950/80 p-4 sm:p-6 md:p-8 flex flex-col relative"
          >
            {/* Textbook Page Header */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-widest font-mono">
              <span className="truncate max-w-[320px]">{currentPage.chapterTitle}</span>
              <span className="text-indigo-400 font-bold">Page {currentPage.pageNumber}</span>
            </div>

            {/* Rendered Academic Content */}
            <div className="prose prose-invert prose-indigo max-w-none text-slate-200 text-sm leading-relaxed space-y-4">
              <div
                dangerouslySetInnerHTML={{
                  __html: formatTextbookContent(currentPage.content),
                }}
              />
            </div>

            {/* Key Takeaways Box */}
            {currentPage.keyTakeaways && currentPage.keyTakeaways.length > 0 && (
              <div className="mt-8 p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-300 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Key Concepts for Exam Review:</span>
                </div>
                <ul className="space-y-1.5 list-disc list-inside text-slate-300">
                  {currentPage.keyTakeaways.map((takeaway, i) => (
                    <li key={i} className="leading-snug">
                      {takeaway}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
              <span>{book.title} ({book.edition})</span>
              <span>Kurose & Ross</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Formats markdown-like textbook text into rich HTML with diagrams, styled tables, and code blocks
 */
function formatTextbookContent(content: string): string {
  // First preserve code/text blocks
  const blocks: string[] = [];
  let processed = content.replace(/```text([\s\S]*?)```/gm, (_, code) => {
    blocks.push(
      `<pre class="p-4 bg-slate-950 rounded-xl border border-slate-800 text-indigo-300 font-mono text-[11px] leading-tight overflow-x-auto my-4 shadow-inner">${code.trim()}</pre>`
    );
    return `__BLOCK_${blocks.length - 1}__`;
  });

  // Headings
  processed = processed
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-slate-100 mt-5 mb-3 tracking-tight border-b border-slate-800/80 pb-2">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold text-indigo-300 mt-4 mb-2">$1</h3>')
    // Bold & Italics
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-100 font-semibold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="text-slate-300 italic">$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-slate-800 text-indigo-300 rounded font-mono text-xs border border-slate-700/60">$1</code>');

  // Split into lines/paragraphs
  const lines = processed.split("\n");
  const result: string[] = [];
  let inList = false;

  for (let line of lines) {
    line = line.trim();
    if (!line) {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      continue;
    }

    if (line.startsWith("__BLOCK_")) {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(line);
    } else if (line.startsWith("<h2") || line.startsWith("<h3")) {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(line);
    } else if (/^\d+\.\s/.test(line)) {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      const itemContent = line.replace(/^\d+\.\s*/, "");
      result.push(`<div class="flex items-start gap-2.5 my-2 pl-2"><span class="w-5 h-5 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">${line.match(/^\d+/)?.[0]}</span><div class="text-slate-300 text-xs leading-relaxed flex-1">${itemContent}</div></div>`);
    } else if (line.startsWith("* ")) {
      if (!inList) {
        result.push('<ul class="space-y-1.5 my-2 pl-4 list-disc text-slate-300 text-xs leading-relaxed">');
        inList = true;
      }
      result.push(`<li>${line.slice(2)}</li>`);
    } else {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(`<p class="text-slate-300 text-xs leading-relaxed mb-3">${line}</p>`);
    }
  }

  if (inList) {
    result.push("</ul>");
  }

  let finalHtml = result.join("\n");

  // Restore code blocks
  blocks.forEach((block, idx) => {
    finalHtml = finalHtml.replace(`__BLOCK_${idx}__`, block);
  });

  // Render KaTeX math formulas
  return renderMathInText(finalHtml);
}
