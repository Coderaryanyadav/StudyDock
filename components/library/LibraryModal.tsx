"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  BookOpen,
  Plus,
  Trash2,
  Clock,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Search,
} from "lucide-react";
import { Book } from "@/types";

export interface LibraryBookItem {
  id: string;
  title: string;
  author?: string;
  edition?: string;
  subject?: string;
  totalPages: number;
  status: string;
  statusMessage?: string;
  lastPageRead: number;
  youtubeUrl?: string;
  videoTitle?: string;
  createdAt: string;
  updatedAt?: string;
}

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBookId?: string;
  onSelectBook: (bookId: string) => void;
  onOpenUploadModal: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  activeBookId,
  onSelectBook,
  onOpenUploadModal,
}) => {
  const [books, setBooks] = useState<LibraryBookItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBooks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/books");
      const data = await res.json();
      if (res.ok && data.success) {
        setBooks(data.books || []);
      } else {
        setBooks([]);
      }
    } catch (err: any) {
      console.warn("Fetch books error:", err);
      setBooks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBooks();
    }
  }, [isOpen]);

  const handleDeleteBook = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to remove this textbook from your library?")) return;

    setDeletingId(bookId);
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBooks((prev) => prev.filter((b) => b.id !== bookId));
      }
    } catch (err) {
      console.error("Delete book error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  const filteredBooks = books.filter((b) =>
    searchQuery
      ? b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.subject && b.subject.toLowerCase().includes(searchQuery.toLowerCase()))
      : true
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#0d131f] border border-slate-800 rounded-xl p-6 md:p-8 shadow-2xl space-y-5 text-slate-100 max-h-[85vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Academic Library</h3>
              <p className="text-xs text-slate-400">Your personal cloud collection of textbooks and study indexes</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenUploadModal();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Import Book</span>
            </button>
            
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {books.length > 0 && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              aria-label="Search Library Textbooks"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by book title, author, or subject..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#070b12] border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          </div>
        )}

        {/* Books Grid */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
              <p className="text-xs">Loading your academic library...</p>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="py-14 text-center space-y-4 border border-dashed border-slate-800 rounded-lg p-6 bg-slate-950/40">
              <div className="w-12 h-12 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-slate-200">
                  {searchQuery ? "No textbooks match your search" : "No Textbooks in Library Yet"}
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchQuery
                    ? "Try adjusting your search terms or import a new PDF."
                    : "Upload your course textbook PDF to enable RAG-powered tutoring, timestamped video synchronization, and personalized mastery tracking."}
                </p>
              </div>
              {!searchQuery && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenUploadModal();
                  }}
                  aria-label="Import First Textbook PDF"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                >
                  <Plus className="w-4 h-4" />
                  <span>Import First Textbook PDF</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5" role="list" aria-label="Library Textbooks">
              {filteredBooks.map((book) => {
                const isSelected = activeBookId === book.id;
                const progressPct = Math.round(
                  ((book.lastPageRead || 1) / Math.max(1, book.totalPages || 1)) * 100
                );

                return (
                  <div
                    key={book.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open textbook ${book.title} (Page ${book.lastPageRead || 1} of ${book.totalPages})`}
                    onClick={() => {
                      onSelectBook(book.id);
                      onClose();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectBook(book.id);
                        onClose();
                      }
                    }}
                    className={`p-4 rounded-lg border transition-all cursor-pointer flex gap-4 items-start focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                      isSelected
                        ? "bg-indigo-950/30 border-indigo-500/60 shadow-sm"
                        : "bg-[#080c14] border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {/* Realistic Academic Volume Mockup Spine */}
                    <div className="w-16 h-24 rounded bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 border border-indigo-900/40 flex flex-col justify-between p-2 relative overflow-hidden shadow shrink-0">
                      <div className="w-1 h-full absolute left-0 top-0 bottom-0 bg-indigo-500/40" />
                      <span className="text-[9px] font-mono text-indigo-300 bg-indigo-950/80 px-1 py-0.5 rounded border border-indigo-800/40 truncate">
                        {book.edition || "PDF"}
                      </span>
                      <div className="text-[10px] font-bold text-white line-clamp-2 leading-tight">
                        {book.title}
                      </div>
                    </div>

                    {/* Book Metadata & Actions */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-sm text-white truncate">{book.title}</h4>
                          <button
                            onClick={(e) => handleDeleteBook(e, book.id)}
                            disabled={deletingId === book.id}
                            aria-label={`Remove textbook ${book.title} from library`}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none rounded"
                            title="Remove textbook"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {book.author ? `by ${book.author}` : "Author Unknown"}
                        </p>
                      </div>

                      {/* Status indicator */}
                      {book.status === "PROCESSING" || book.status === "EMBEDDING" || book.status === "UPLOADING" ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{book.status === "EMBEDDING" ? "Generating Vector Embeddings..." : "Processing & Indexing..."}</span>
                        </div>
                      ) : book.status === "OCR_REQUIRED" ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Scanned PDF (OCR Required)</span>
                        </div>
                      ) : book.status === "FAILED" ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-rose-400 font-medium">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Processing Failed</span>
                        </div>
                      ) : (
                        /* Progress bar for READY books */
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>Progress</span>
                            <span className="text-indigo-400 font-semibold">
                              Page {book.lastPageRead || 1} / {book.totalPages} ({progressPct}% )
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${progressPct}%` }}
                              className="h-full bg-indigo-500 rounded-full"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[10px] font-mono text-slate-500">
                          {book.subject || "General Studies"}
                        </span>
                        <span className="text-indigo-400 font-semibold flex items-center gap-1">
                          <span>{isSelected ? "Active Book" : book.status === "READY" ? "Open Book" : "View Status"}</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
