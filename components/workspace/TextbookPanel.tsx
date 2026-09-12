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
  Edit2,
  Trash2,
  Plus,
} from "lucide-react";
import { Book, BookPage, Highlight, HighlightRect, LearningMode, Note } from "@/types";
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
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"pdf" | "text">("pdf");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteContent, setNewNoteContent] = useState<string>("");
  const [noteSelectedText, setNoteSelectedText] = useState<string>("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<"yellow" | "green" | "blue" | "pink">("yellow");
  const [pendingSelectionCoords, setPendingSelectionCoords] = useState<{
    boundingRect?: HighlightRect;
    rects?: HighlightRect[];
  } | null>(null);
  
  const [selectionToolbarPos, setSelectionToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const [pageInputVal, setPageInputVal] = useState<string>(String(activePageNumber));

  useEffect(() => {
    setPageInputVal(String(activePageNumber));
  }, [activePageNumber]);

  // Persist current page to database for resume functionality
  useEffect(() => {
    if (book?.id && activePageNumber >= 1) {
      fetch(`/api/books/${encodeURIComponent(book.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastPageRead: activePageNumber }),
      }).catch(() => {});
    }
  }, [book?.id, activePageNumber]);

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInputVal, 10);
    const maxPages = book.totalPages || book.pages.length || 1;
    if (!isNaN(parsed) && parsed >= 1 && parsed <= maxPages) {
      onPageChange(parsed);
    } else {
      setPageInputVal(String(activePageNumber));
    }
  };

  // 1. Load persistent annotations, bookmarks & notes from database
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

    fetch(`/api/notes?bookId=${encodeURIComponent(book.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.notes)) {
          setNotes(data.notes);
        }
      })
      .catch((err) => console.warn("Failed to load notes:", err));
  }, [book?.id]);

  // Reset scroll position to top when page changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activePageNumber]);

  // Scroll to citation target if specified
  useEffect(() => {
    if (targetCitationPage && targetCitationPage !== activePageNumber) {
      onPageChange(targetCitationPage);
      if (onClearTargetCitation) onClearTargetCitation();
    }
  }, [targetCitationPage, activePageNumber, onPageChange, onClearTargetCitation]);

  const isCurrentPageBookmarked = bookmarks.includes(activePageNumber);

  const toggleBookmark = async () => {
    const isBookmarked = isCurrentPageBookmarked;
    const newBookmarks = isBookmarked
      ? bookmarks.filter((p) => p !== activePageNumber)
      : [...bookmarks, activePageNumber].sort((a, b) => a - b);

    setBookmarks(newBookmarks);

    if (book?.id) {
      if (isBookmarked) {
        await fetch(`/api/annotations?bookId=${encodeURIComponent(book.id)}&type=bookmark&pageNumber=${activePageNumber}`, {
          method: "DELETE",
        }).catch(() => {});
      } else {
        await fetch("/api/annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: book.id,
            type: "bookmark",
            pageNumber: activePageNumber,
            title: `Bookmark on Page ${activePageNumber}`,
          }),
        }).catch(() => {});
      }
    }
  };

  const handleCreateHighlight = async (color: "yellow" | "green" | "blue" | "pink") => {
    if (!selectedText.trim() || !book?.id) return;
    const tempId = `hl-${Date.now()}`;
    const newHighlight: Highlight = {
      id: tempId,
      bookId: book.id,
      pageNumber: activePageNumber,
      text: selectedText,
      color,
      boundingRect: pendingSelectionCoords?.boundingRect || null,
      rects: pendingSelectionCoords?.rects || [],
      createdAt: new Date().toISOString(),
    };

    setHighlights((prev) => [...prev, newHighlight]);
    setSelectionToolbarPos(null);

    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          type: "highlight",
          pageNumber: activePageNumber,
          text: selectedText,
          color,
          boundingRect: pendingSelectionCoords?.boundingRect || null,
          rects: pendingSelectionCoords?.rects || [],
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        setHighlights((prev) => prev.map((h) => (h.id === tempId ? { ...h, id: data.id } : h)));
      }
    } catch (err) {
      console.warn("Failed to save highlight:", err);
    }
  };

  const handleDeleteHighlight = async (highlightId: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
    if (book?.id) {
      await fetch(`/api/annotations?bookId=${encodeURIComponent(book.id)}&type=highlight&id=${encodeURIComponent(highlightId)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  };

  const handleSaveNote = async () => {
    if (!newNoteContent.trim() || !book?.id) return;
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          pageNumber: activePageNumber,
          content: newNoteContent.trim(),
          selectedText: noteSelectedText || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.note) {
        setNotes((prev) => [data.note, ...prev]);
        setNewNoteContent("");
        setNoteSelectedText("");
      }
    } catch (err) {
      console.warn("Failed to save note:", err);
    }
  };

  const handleUpdateNote = async (id: string) => {
    if (!editingContent.trim() || !book?.id) return;
    try {
      const res = await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          bookId: book.id,
          content: editingContent.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.note) {
        setNotes((prev) => prev.map((n) => (n.id === id ? data.note : n)));
        setEditingNoteId(null);
        setEditingContent("");
      }
    } catch (err) {
      console.warn("Failed to update note:", err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      await fetch(`/api/notes?id=${encodeURIComponent(id)}&bookId=${encodeURIComponent(book.id)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.warn("Failed to delete note:", err);
    }
  };

  // Text selection handler
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionToolbarPos(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 2) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(text);
      setSelectionToolbarPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
    } else {
      setSelectionToolbarPos(null);
    }
  };

  const activePageObj = book.pages?.find((p) => p.pageNumber === activePageNumber);
  const totalPagesCount = book.totalPages || book.pages.length || 1;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d16] text-slate-100 overflow-hidden relative select-text">
      
      {/* ========================================================================= */}
      {/* Top Academic Reader Toolbar */}
      {/* ========================================================================= */}
      <div className="h-12 bg-[#0c121e] border-b border-slate-800 px-3 md:px-4 flex items-center justify-between shrink-0 select-none z-10 text-xs">
        
        {/* Left Controls: ToC, Bookmarks, Highlights, Notes */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setShowToc(!showToc);
              setShowBookmarks(false);
              setShowHighlights(false);
              setShowNotes(false);
            }}
            data-testid="toc-drawer-btn"
            aria-label="Toggle Table of Contents"
            aria-expanded={showToc}
            className={`p-1.5 rounded-md transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              showToc ? "bg-indigo-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
            title="Table of Contents (B)"
          >
            <ListTree className="w-4 h-4" />
            <span className="hidden sm:inline font-medium">Contents</span>
          </button>

          <button
            onClick={() => {
              setShowBookmarks(!showBookmarks);
              setShowToc(false);
              setShowHighlights(false);
              setShowNotes(false);
            }}
            data-testid="bookmarks-drawer-btn"
            aria-label="View Saved Bookmarks"
            aria-expanded={showBookmarks}
            className={`p-1.5 rounded-md transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              showBookmarks ? "bg-indigo-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
            title="Bookmarks"
          >
            <Bookmark className="w-4 h-4" />
            <span className="font-mono text-[11px] font-semibold" data-testid="bookmarks-count">({bookmarks.length})</span>
          </button>

          <button
            onClick={() => {
              setShowHighlights(!showHighlights);
              setShowToc(false);
              setShowBookmarks(false);
              setShowNotes(false);
            }}
            data-testid="highlights-drawer-btn"
            aria-label="View Highlights"
            aria-expanded={showHighlights}
            className={`p-1.5 rounded-md transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              showHighlights ? "bg-indigo-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
            title="Highlights"
          >
            <Highlighter className="w-4 h-4" />
            <span className="font-mono text-[11px] font-semibold" data-testid="highlights-count">({highlights.length})</span>
          </button>

          <button
            onClick={() => {
              setShowNotes(!showNotes);
              setShowToc(false);
              setShowBookmarks(false);
              setShowHighlights(false);
            }}
            data-testid="notes-drawer-btn"
            aria-label="View Study Notes"
            aria-expanded={showNotes}
            className={`p-1.5 rounded-md transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              showNotes ? "bg-indigo-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
            title="Study Notes"
          >
            <FileText className="w-4 h-4" />
            <span className="font-mono text-[11px] font-semibold" data-testid="notes-count">({notes.length})</span>
          </button>
        </div>

        {/* Center: Clean Page Navigation */}
        <div className="flex items-center gap-2 bg-[#060910] px-2 py-0.5 rounded-md border border-slate-800">
          <button
            onClick={() => onPageChange(Math.max(1, activePageNumber - 1))}
            disabled={activePageNumber <= 1}
            data-testid="prev-page-btn"
            aria-label="Previous Page"
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            title="Previous Page (←)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
            <input
              type="text"
              data-testid="page-number-input"
              aria-label="Current Page Number"
              value={pageInputVal}
              onChange={(e) => setPageInputVal(e.target.value)}
              className="w-10 h-6 bg-slate-800 text-center font-mono font-bold text-white text-xs rounded border border-slate-700 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
            <span className="text-slate-500 font-mono text-[11px]">/ {totalPagesCount}</span>
          </form>

          <button
            onClick={() => onPageChange(Math.min(totalPagesCount, activePageNumber + 1))}
            disabled={activePageNumber >= totalPagesCount}
            data-testid="next-page-btn"
            aria-label="Next Page"
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            title="Next Page (→)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right Controls: Bookmark Current Page, View Mode, Zoom */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleBookmark}
            data-testid="bookmark-toggle-btn"
            aria-label={isCurrentPageBookmarked ? "Remove Bookmark" : "Bookmark this page"}
            className={`p-1.5 rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              isCurrentPageBookmarked
                ? "text-amber-400 bg-amber-400/10 border border-amber-400/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title={isCurrentPageBookmarked ? "Remove Bookmark" : "Bookmark this page"}
          >
            {isCurrentPageBookmarked ? (
              <BookmarkCheck className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>

          <div className="hidden sm:flex items-center gap-1 border-l border-slate-800 pl-1.5">
            <button
              onClick={() => setZoomLevel((prev) => Math.max(50, prev - 10))}
              aria-label="Zoom Out"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] text-slate-400 w-9 text-center">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel((prev) => Math.min(200, prev + 10))}
              aria-label="Zoom In"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setViewMode(viewMode === "pdf" ? "text" : "pdf")}
            aria-label={`Switch to ${viewMode === "pdf" ? "Text" : "PDF"} mode`}
            className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-[11px] font-medium transition-colors border border-slate-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            <Eye className="w-3.5 h-3.5 text-indigo-400" />
            <span>{viewMode === "pdf" ? "Text" : "PDF"}</span>
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* Side Drawers: Table of Contents, Bookmarks, Highlights, Notes */}
      {/* ========================================================================= */}
      {showToc && (
        <div className="absolute left-0 top-12 bottom-0 w-80 bg-[#0c121e] border-r border-slate-800 z-30 flex flex-col shadow-2xl animate-in slide-in-from-left duration-150">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListTree className="w-4 h-4 text-indigo-400" />
              <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Table of Contents</h4>
            </div>
            <button onClick={() => setShowToc(false)} className="p-1 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar text-xs">
            {book.chapters && book.chapters.length > 0 ? (
              book.chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    onPageChange(ch.startPage);
                    setShowToc(false);
                  }}
                  className={`w-full text-left p-2 rounded-md transition-colors flex items-center justify-between ${
                    activePageNumber >= ch.startPage && activePageNumber <= ch.endPage
                      ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-medium"
                      : "text-slate-300 hover:bg-slate-800/80"
                  }`}
                >
                  <span className="truncate pr-2">{ch.title}</span>
                  <span className="font-mono text-[10px] text-slate-500 shrink-0">p.{ch.startPage}</span>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-slate-500 text-xs">No chapter outline indexed.</div>
            )}
          </div>
        </div>
      )}

      {showBookmarks && (
        <div className="absolute left-0 top-12 bottom-0 w-80 bg-[#0c121e] border-r border-slate-800 z-30 flex flex-col shadow-2xl animate-in slide-in-from-left duration-150">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-amber-400" />
              <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Saved Bookmarks</h4>
            </div>
            <button onClick={() => setShowBookmarks(false)} className="p-1 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar text-xs">
            {bookmarks.length > 0 ? (
              bookmarks.map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => {
                    onPageChange(pageNum);
                    setShowBookmarks(false);
                  }}
                  className="w-full text-left p-2.5 rounded-md bg-slate-900 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between transition-colors text-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                    <span>Page {pageNum}</span>
                  </div>
                  <span className="text-[10px] text-indigo-400 font-medium">Jump →</span>
                </button>
              ))
            ) : (
              <div className="p-6 text-center text-slate-500 text-xs">No bookmarks saved yet.</div>
            )}
          </div>
        </div>
      )}

      {showHighlights && (
        <div className="absolute left-0 top-12 bottom-0 w-80 bg-[#0c121e] border-r border-slate-800 z-30 flex flex-col shadow-2xl animate-in slide-in-from-left duration-150">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Highlighter className="w-4 h-4 text-indigo-400" />
              <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Highlights ({highlights.length})</h4>
            </div>
            <button onClick={() => setShowHighlights(false)} className="p-1 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar text-xs">
            {highlights.length > 0 ? (
              highlights.map((hl) => (
                <div
                  key={hl.id}
                  className="p-3 rounded-md bg-slate-900 border border-slate-800 space-y-2 text-slate-200"
                >
                  <p className="line-clamp-3 italic text-[11px] text-slate-300 border-l-2 border-indigo-400 pl-2">
                    &ldquo;{hl.text}&rdquo;
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <button
                      onClick={() => {
                        onPageChange(hl.pageNumber);
                        setShowHighlights(false);
                      }}
                      className="text-indigo-400 hover:text-indigo-300 font-mono text-[11px]"
                    >
                      Page {hl.pageNumber} →
                    </button>
                    <button
                      onClick={() => handleDeleteHighlight(hl.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete highlight"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-500 text-xs">Select text in the reader to highlight passages.</div>
            )}
          </div>
        </div>
      )}

      {showNotes && (
        <div className="absolute left-0 top-12 bottom-0 w-88 bg-[#0c121e] border-r border-slate-800 z-30 flex flex-col shadow-2xl animate-in slide-in-from-left duration-150">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Study Notes ({notes.length})</h4>
            </div>
            <button onClick={() => setShowNotes(false)} className="p-1 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Create Note Form */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-950/60 space-y-2">
            <div className="text-[11px] text-slate-400 font-medium">Add note for Page {activePageNumber}:</div>
            <textarea
              data-testid="new-note-input"
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Type your study notes, key takeaways, or equations..."
              rows={3}
              className="w-full p-2 rounded bg-slate-900 border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <button
              onClick={handleSaveNote}
              disabled={!newNoteContent.trim()}
              data-testid="save-note-btn"
              className="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Note</span>
            </button>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar text-xs">
            {notes.map((note) => (
              <div
                key={note.id}
                className="p-3 rounded-md bg-slate-900 border border-slate-800 space-y-2 text-slate-200"
              >
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      rows={3}
                      className="w-full p-2 rounded bg-slate-950 border border-indigo-500 text-white text-xs resize-none"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUpdateNote(note.id)}
                        className="px-2.5 py-1 rounded bg-indigo-600 text-white text-[11px] font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {note.selectedText && (
                      <p className="text-[10px] italic text-slate-400 border-l border-slate-700 pl-2 line-clamp-2">
                        &ldquo;{note.selectedText}&rdquo;
                      </p>
                    )}
                    <p className="text-xs text-slate-100 whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-500">
                      <button
                        onClick={() => onPageChange(note.pageNumber)}
                        className="text-indigo-400 hover:text-indigo-300 font-mono"
                      >
                        Page {note.pageNumber} →
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setEditingContent(note.content);
                          }}
                          className="p-1 hover:text-slate-200"
                          title="Edit note"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 hover:text-rose-400"
                          title="Delete note"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Main Reading Surface: PDF or Clean Text */}
      {/* ========================================================================= */}
      <div
        ref={contentRef}
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-[#070b12] custom-scrollbar"
      >
        {viewMode === "pdf" ? (
          <div className="w-full flex justify-center">
            <PdfViewer
              bookId={book.id}
              pageNumber={activePageNumber}
              scale={zoomLevel / 100}
              onPageChange={onPageChange}
              onSelectionCoords={(coords) => {
                setPendingSelectionCoords({
                  boundingRect: coords.boundingRect,
                  rects: coords.rects,
                });
              }}
              highlights={highlights.filter((h) => h.pageNumber === activePageNumber)}
              totalPages={totalPagesCount}
            />
          </div>
        ) : (
          <div
            style={{ maxWidth: "720px", transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
            className="w-full bg-[#0d131f] border border-slate-800/90 rounded-lg p-6 md:p-10 shadow-lg text-slate-200 space-y-4 leading-relaxed font-serif text-sm md:text-base transition-transform"
          >
            <div className="pb-3 border-b border-slate-800 flex items-center justify-between font-sans">
              <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                {activePageObj?.chapterTitle || "Chapter Reading"}
              </span>
              <span className="text-xs font-mono text-slate-500">Page {activePageNumber}</span>
            </div>
            
            <h2 className="text-xl md:text-2xl font-bold font-sans text-white pt-2">
              {activePageObj?.sectionTitle || activePageObj?.title || `Page ${activePageNumber}`}
            </h2>

            <div className="text-slate-300 whitespace-pre-line leading-loose font-serif">
              {renderMathInText(activePageObj?.content || "No extracted text available for this page.")}
            </div>
          </div>
        )}
      </div>

      {/* Floating Selection Toolbar */}
      {selectionToolbarPos && selectedText && (
        <TextbookSelectionToolbar
          position={selectionToolbarPos}
          selectedText={selectedText}
          onAction={(action, mode) => {
            if (action === "highlight") {
              handleCreateHighlight(selectedHighlightColor);
            } else if (action === "note") {
              setShowNotes(true);
              setNoteSelectedText(selectedText);
              setSelectionToolbarPos(null);
            } else {
              onAskAIWithSelection(selectedText, mode);
              setSelectionToolbarPos(null);
            }
          }}
          onClose={() => setSelectionToolbarPos(null)}
        />
      )}

    </div>
  );
};
