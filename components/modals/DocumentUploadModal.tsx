"use client";

import React, { useState } from "react";
import { X, Upload, FileText, CheckCircle2, AlertCircle, Sparkles, Loader2, Database, Cpu } from "lucide-react";
import { Book } from "@/types";

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
  const [title, setTitle] = useState<string>("Operating Systems: Three Easy Pieces");
  const [author, setAuthor] = useState<string>("Remzi & Andrea Arpaci-Dusseau");
  const [subject, setSubject] = useState<string>("Computer Systems");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [processStep, setProcessStep] = useState<"idle" | "uploading" | "extracting" | "indexing" | "ready">("idle");
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!title || title === "Operating Systems: Three Easy Pieces") {
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
      formData.append("author", author || "Academic Author");
      formData.append("subject", subject);

      // Transition step indicators
      setTimeout(() => {
        setProcessStep("extracting");
      }, 500);

      setTimeout(() => {
        setProcessStep("indexing");
      }, 1200);

      const res = await fetch("/api/documents/process", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process document.");
      }

      setProcessStep("ready");
      setTimeout(() => {
        onDocumentUploaded(data.book);
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.message || "Failed to process and index document.");
      setProcessStep("idle");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5 text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Upload Textbook / Document</h3>
              <p className="text-xs text-slate-400">PDF documents with real text extraction & RAG indexing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          {/* Dropzone */}
          <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-950/60 relative">
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileChange}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="space-y-2 flex flex-col items-center">
              <FileText className="w-8 h-8 text-indigo-400" />
              <div className="text-xs font-semibold text-slate-200">
                {file ? file.name : "Choose a PDF or drag & drop"}
              </div>
              <p className="text-[11px] text-slate-500">
                Supported formats: PDF, Text (Max 50MB)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Book / Document Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Distributed Systems"
                required
                disabled={isUploading}
                className="w-full bg-slate-950 text-xs px-3 py-2 rounded-xl border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Subject Area
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Computer Science"
                required
                disabled={isUploading}
                className="w-full bg-slate-950 text-xs px-3 py-2 rounded-xl border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Progressive Indexing Pipeline Status */}
          {isUploading && (
            <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/30 text-xs text-indigo-200 space-y-2">
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  {processStep === "uploading" && "Uploading document stream..."}
                  {processStep === "extracting" && "Extracting pages & detecting chapters..."}
                  {processStep === "indexing" && "Generating semantic vector chunks (pgvector)..."}
                  {processStep === "ready" && "Document verified & ready for study!"}
                </span>
                <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">
                  Pipeline Active
                </span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500 ${
                    processStep === "uploading"
                      ? "w-1/4"
                      : processStep === "extracting"
                      ? "w-2/3"
                      : processStep === "indexing"
                      ? "w-5/6"
                      : "w-full"
                  }`}
                />
              </div>
            </div>
          )}

          {!isUploading && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Real Text Extraction & pgvector Chunking
              </div>
              <p>
                Your PDF will be parsed with sentence boundaries preserved, sections extracted, and indexed with embeddings for precise grounded citations.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white transition-colors flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Process & Study</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
