"use client";

import React, { useState } from "react";
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Database, Cpu, BookOpen } from "lucide-react";
import { Book } from "@/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentUploaded: (newBook: Book) => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onDocumentUploaded,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [author, setAuthor] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [processStep, setProcessStep] = useState<"idle" | "uploading" | "extracting" | "indexing" | "ready">("idle");
  const [error, setError] = useState<string>("");
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a PDF document to upload.");
      return;
    }

    setIsUploading(true);
    setProcessStep("uploading");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title || file.name);
      formData.append("author", author || "Unknown Author");
      formData.append("subject", subject || "General");

      const supabase = getSupabaseBrowserClient();
      const headers: Record<string, string> = {};
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          headers["Authorization"] = `Bearer ${sessionData.session.access_token}`;
        }
      }

      const res = await fetch("/api/documents/process", {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process document.");
      }

      setProcessStep("ready");
      onDocumentUploaded(data.book);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to process and index document.");
      setProcessStep("idle");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      data-testid="upload-modal-content"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-lg bg-[#0d131f] border border-slate-800 rounded-xl p-6 md:p-8 shadow-2xl space-y-5 text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 id="upload-modal-title" className="font-bold text-base text-white">Import Textbook PDF</h3>
              <p className="text-xs text-slate-400">Upload your course textbook for private PDF viewing and vector RAG</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close upload dialog"
            data-testid="close-upload-modal-btn"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          {/* Dropzone */}
          <div className="border border-dashed border-slate-700 hover:border-indigo-500 rounded-lg p-6 text-center cursor-pointer transition-colors bg-[#070b12] relative focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500">
            <input
              type="file"
              accept=".pdf,application/pdf"
              data-testid="pdf-dropzone-input"
              aria-label="Upload PDF document"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-xs">
                {file ? (
                  <span className="font-semibold text-emerald-400" data-testid="uploaded-file-name">{file.name}</span>
                ) : (
                  <>
                    <span className="font-semibold text-white">Click to upload</span> or drag and drop
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-400">PDF documents up to 50MB</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-slate-300 font-medium">Textbook Title</label>
              <input
                type="text"
                required
                data-testid="import-title-input"
                aria-label="Textbook Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Operating Systems: Three Easy Pieces"
                className="w-full px-3 py-2 rounded-lg bg-[#070b12] border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Author(s)</label>
              <input
                type="text"
                data-testid="import-author-input"
                aria-label="Author(s)"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g., Remzi Arpaci-Dusseau"
                className="w-full px-3 py-2 rounded-lg bg-[#070b12] border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Course / Subject</label>
              <input
                type="text"
                data-testid="import-subject-input"
                aria-label="Course or Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Computer Systems"
                className="w-full px-3 py-2 rounded-lg bg-[#070b12] border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>
          </div>

          {error && (
            <div data-testid="import-error-alert" className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isUploading && (
            <div data-testid="import-loading-state" className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Extracting PDF text and generating vector chunks...</span>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              data-testid="submit-upload-btn"
              aria-label="Import and Index Textbook PDF"
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>Import & Index</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
