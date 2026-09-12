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
  Sparkles,
  ArrowRight,
  ExternalLink,
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBooks = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/books");
      const data = await res.json();
      if (res.ok && data.success) {
        setBooks(data.books || []);
      } else {
        // Empty state or auth notice
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
    if (!confirm("Are you sure you want to delete this textbook from your library?")) return;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5 text-slate-100 max-h-[85vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">My Academic Library</h3>
              <p className="text-xs text-slate-400">Your imported textbooks, notes, and study indexes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenUploadModal();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Import Book</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Books List / Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
              <p className="text-xs">Loading your textbooks...</p>
            </div>
          ) : books.length === 0 ? (
            <div className="py-14 text-center space-y-4 border border-dashed border-slate-800 rounded-2xl p-6 bg-slate-950/40">
              <div className="w-12 h-12 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-slate-200">No Textbooks Imported Yet</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Import your course PDF textbooks, open educational resources, or lecture slides to start studying.
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenUploadModal();
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
              >
                <Plus className="w-4 h-4" />
                <span>Import First Textbook</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {books.map((book) => {
                const isActive = book.id === activeBookId;
                return (
                  <div
                    key={book.id}
                    onClick={() => {
                      onSelectBook(book.id);
                      onClose();
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 group ${
                      isActive
                        ? "bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-950/50"
                        : "bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-12 rounded-xl bg-gradient-to-br from-indigo-900 to-slate-900 border border-slate-700 flex items-center justify-center text-indigo-300 shrink-0 font-bold text-xs shadow-sm">
                        PDF
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                            {book.title}
                          </h4>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono border border-indigo-500/30">
                              Active
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              book.status === "READY"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : book.status === "PROCESSING" || book.status === "EMBEDDING"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {book.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-3">
                          <span>{book.totalPages} pages</span>
                          <span>•</span>
                          <span>Last position: p.{book.lastPageRead || 1}</span>
                          {book.subject && (
                            <>
                              <span>•</span>
                              <span className="text-slate-300">{book.subject}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteBook(e, book.id)}
                        disabled={deletingId === book.id}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete textbook"
                      >
                        {deletingId === book.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                      <div className="p-2 rounded-xl bg-slate-800 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white transition-colors">
                        <ArrowRight className="w-4 h-4" />
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
