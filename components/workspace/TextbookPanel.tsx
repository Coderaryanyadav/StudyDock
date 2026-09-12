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
  Eye,
} from "lucide-react";
import { Book, BookPage, Highlight, LearningMode } from "@/types";
import { TextbookSelectionToolbar } from "./TextbookSelectionToolbar";
import { PdfViewer } from "./PdfViewer";
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
  const [showHighlights, setShowHighlights] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"pdf" | "text">("pdf");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<"yellow" | "green" | "blue" | "pink">("yellow");
  const [selectionToolbarPos, setSelectionToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const contentRef = useRef<HTMLDivElement>(null);

  // 1. Load persistent annotations & bookmarks from database
  useEffect(() => {
    if (!book?.id) return;
    fetch(`/api/annotations?bookId=${encodeURIComponent(book.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (Array.isArray(data.highlights)) {
            setHighlights(data.highlights);
          }
          if (Array.isArray(data.bookmarks)) {
            setBookmarks(data.bookmarks.map((b: any) => b.pageNumber));
          }
        }
      })
      .catch((err) => console.warn("Failed to load annotations:", err));
  }, [book?.id]);

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
      chapterId: null,
      chapterTitle: null,
      sectionId: null,
      sectionTitle: null,
      title: `Page ${activePageNumber}`,
      content: "",
    };

  // Handle text selection in textbook / PDF canvas
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionToolbarPos(null);
      setSelectedText("");
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 2) {
      setSelectedText(text);
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionToolbarPos({
          x: Math.max(10, rect.left + rect.width / 2 - 100),
          y: Math.max(10, rect.top - 10),
        });
      } catch (e) {
        setSelectionToolbarPos(null);
      }
    } else {
      setSelectionToolbarPos(null);
      setSelectedText("");
    }
  };

  const handleSelectionAction = (
    action: "explain" | "simplify" | "example" | "ask" | "flashcard" | "quiz" | "highlight" | "note",
    mode?: LearningMode
  ) => {
    if (!selectedText) return;

    if (action === "highlight") {
      const tempId = `hl-${Date.now()}`;
      const newHl: Highlight = {
        id: tempId,
        bookId: book.id,
        pageNumber: activePageNumber,
        text: selectedText,
        color: selectedHighlightColor,
        createdAt: new Date().toISOString(),
      };
      setHighlights((prev) => [newHl, ...prev]);

      fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "highlight",
          bookId: book.id,
          pageNumber: activePageNumber,
          text: selectedText,
          color: selectedHighlightColor,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.id) {
            setHighlights((prev) =>
              prev.map((h) => (h.id === tempId ? { ...h, id: data.id } : h))
            );
          }
        })
        .catch((err) => console.warn("Failed to persist highlight:", err));

      setSelectionToolbarPos(null);
      window.getSelection()?.removeAllRanges();
      return;
    }

    onAskAIWithSelection(selectedText, mode || (action as LearningMode));
    setSelectionToolbarPos(null);
    window.getSelection()?.removeAllRanges();
  };

  const toggleBookmark = () => {
    const isBookmarked = bookmarks.includes(activePageNumber);
    if (isBookmarked) {
      setBookmarks((prev) => prev.filter((p) => p !== activePageNumber));
      fetch(`/api/annotations?type=bookmark&bookId=${encodeURIComponent(book.id)}&pageNumber=${activePageNumber}`, {
        method: "DELETE",
      }).catch((err) => console.warn("Failed to remove bookmark:", err));
    } else {
      setBookmarks((prev) => [...prev, activePageNumber]);
      fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bookmark",
          bookId: book.id,
          pageNumber: activePageNumber,
          title: `Page ${activePageNumber}`,
        }),
      }).catch((err) => console.warn("Failed to persist bookmark:", err));
    }
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(200, Math.max(60, prev + delta)));
  };

  // Search matches across pages
  const searchResults = searchQuery.trim()
    ? book.pages.filter(
        (p) =>
          (p.title && p.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (p.content && p.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 border-r border-slate-800/80 select-text overflow-hidden relative">
      {/* Textbook Header Controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 backdrop-blur-sm z-20">
        {/* Left: TOC, Bookmarks, Highlights drawers & View mode switch */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setShowToc(!showToc);
              setShowBookmarks(false);
              setShowHighlights(false);
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
              setShowHighlights(false);
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

          <button
            onClick={() => {
              setShowHighlights(!showHighlights);
              setShowToc(false);
              setShowBookmarks(false);
            }}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              showHighlights
                ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40"
                : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title="Highlights & Notes"
          >
            <Highlighter className="w-4 h-4 text-yellow-400" />
            <span className="hidden md:inline">({highlights.length})</span>
          </button>

          {/* View Mode Toggle: Original PDF vs Extracted Text */}
          <div className="hidden lg:flex items-center ml-1 pl-1 border-l border-slate-800">
            <button
              onClick={() => setViewMode(viewMode === "pdf" ? "text" : "pdf")}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                viewMode === "pdf"
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
              }`}
              title="Toggle between Original PDF and Text Extraction"
            >
              {viewMode === "pdf" ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Original PDF</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Text View</span>
                </>
              )}
            </button>
          </div>
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

          <div className="flex items-center gap-1 font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 shadow-inner">
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
            title="Search in Textbook"
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

      {/* Search Input Bar */}
      {isSearching && (
        <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2 animate-in slide-in-from-top-2 duration-150">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search within textbook chapters & pages..."
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

      {/* Search Results Overlay */}
      {isSearching && searchQuery.trim().length > 0 && (
        <div className="bg-slate-900/95 border-b border-slate-800 max-h-48 overflow-y-auto px-3 py-2 text-xs divide-y divide-slate-800/60 z-20 shadow-lg">
          <div className="text-[11px] font-semibold text-slate-400 mb-1">
            Found {searchResults.length} matching page(s):
          </div>
          {searchResults.length === 0 ? (
            <div className="text-slate-500 py-1 italic">No matching pages found.</div>
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
                  Page {p.pageNumber}: {p.title || `Page ${p.pageNumber}`}
                </div>
                <span className="text-[10px] text-indigo-400 ml-2">Jump →</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Main Workspace Container */}
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
              {book.chapters.length > 0 ? (
                book.chapters.map((ch) => (
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
                ))
              ) : (
                <div className="space-y-1">
                  {book.pages.slice(0, 30).map((p) => (
                    <button
                      key={p.pageNumber}
                      onClick={() => {
                        onPageChange(p.pageNumber);
                        setShowToc(false);
                      }}
                      className={`w-full text-left py-1 px-1.5 rounded transition-colors text-[11px] flex items-center justify-between ${
                        activePageNumber === p.pageNumber
                          ? "bg-indigo-600/30 text-indigo-300 font-medium"
                          : "text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      <span className="truncate">{p.title || `Page ${p.pageNumber}`}</span>
                      <span className="text-[10px] font-mono text-slate-500">p.{p.pageNumber}</span>
                    </button>
                  ))}
                </div>
              )}
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

        {/* Highlights Drawer */}
        {showHighlights && (
          <div className="w-64 bg-slate-900 border-r border-slate-800 h-full overflow-y-auto p-3 text-xs z-10 flex flex-col shrink-0 animate-in slide-in-from-left duration-150">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
              <span className="font-semibold text-yellow-400 flex items-center gap-1.5">
                <Highlighter className="w-4 h-4" /> Highlights & Notes
              </span>
              <button
                onClick={() => setShowHighlights(false)}
                className="text-slate-400 hover:text-slate-200 p-0.5 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {highlights.length === 0 ? (
                <div className="text-slate-500 italic py-2">
                  No highlights yet. Select text in the reader and click &ldquo;Highlight&rdquo;.
                </div>
              ) : (
                highlights.map((hl) => (
                  <div
                    key={hl.id}
                    onClick={() => {
                      onPageChange(hl.pageNumber);
                      setShowHighlights(false);
                    }}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-yellow-500/50 cursor-pointer transition-all space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-mono text-yellow-400 font-semibold">
                        Page {hl.pageNumber}
                      </span>
                      <span className="opacity-0 group-hover:opacity-100 text-yellow-400">
                        Jump →
                      </span>
                    </div>
                    <p className="text-slate-200 text-[11px] line-clamp-3 italic border-l-2 border-yellow-400/80 pl-2">
                      &ldquo;{hl.text}&rdquo;
                    </p>
                    {hl.note && (
                      <p className="text-slate-400 text-[10px] bg-slate-900 p-1.5 rounded">
                        Note: {hl.note}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Digital Textbook Reading Canvas / Real PDF Canvas */}
        <div
          ref={contentRef}
          onMouseUp={handleMouseUp}
          className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 flex justify-center bg-slate-950/60 custom-scrollbar relative"
        >
          {/* Floating Context Toolbar on Selection */}
          <TextbookSelectionToolbar
            position={selectionToolbarPos}
            selectedText={selectedText}
            onAction={handleSelectionAction}
            onClose={() => setSelectionToolbarPos(null)}
          />

          {viewMode === "pdf" ? (
            /* Real Original Uploaded PDF Canvas Renderer */
            <div className="w-full flex justify-center items-start">
              <PdfViewer
                bookId={book.id}
                pageNumber={activePageNumber}
                scale={zoomLevel / 100}
                onPageChange={onPageChange}
                onMouseUp={handleMouseUp}
                totalPages={book.totalPages || book.pages.length}
              />
            </div>
          ) : (
            /* Extracted Text View */
            <div
              style={{ zoom: `${zoomLevel}%` }}
              className="w-full max-w-3xl bg-slate-900 border border-slate-800/90 rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 flex flex-col relative h-fit"
            >
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-widest font-mono">
                <span className="truncate max-w-[320px]">{currentPage.chapterTitle || book.title}</span>
                <span className="text-indigo-400 font-bold">Page {currentPage.pageNumber}</span>
              </div>

              <div className="prose prose-invert prose-indigo max-w-none text-slate-200 text-sm leading-relaxed space-y-4 whitespace-pre-wrap">
                {currentPage.content ? (
                  currentPage.content
                ) : (
                  <div className="text-slate-500 italic py-8 text-center">
                    This page contains visual elements or formatting displayed in the Original PDF view.
                  </div>
                )}
              </div>

              {currentPage.keyTakeaways && currentPage.keyTakeaways.length > 0 && (
                <div className="mt-8 p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-300 mb-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>Key Concepts:</span>
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

              <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                <span>{book.title}</span>
                <span>{book.author || "Academic Textbook"}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
