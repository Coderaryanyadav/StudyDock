"use client";

import React, { useState } from "react";
import { Youtube, Link, Check, X, BookOpen, AlertCircle } from "lucide-react";
import { VideoLecture } from "@/types";

interface ConnectLectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectLecture: (videoUrl: string, customTitle: string) => void;
}

export const ConnectLectureModal: React.FC<ConnectLectureModalProps> = ({
  isOpen,
  onClose,
  onConnectLecture,
}) => {
  const [url, setUrl] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  const extractYoutubeId = (inputUrl: string): string | null => {
    const match = inputUrl.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    );
    return match ? match[1] : null;
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = extractYoutubeId(url);
    if (!videoId) {
      setError("Please provide a valid YouTube video URL or ID (e.g. https://www.youtube.com/watch?v=...)");
      return;
    }
    setError("");
    onConnectLecture(url, title || "Connected YouTube Lecture");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Connect YouTube Lecture</h3>
              <p className="text-xs text-slate-400">Link video lecture topics directly with your textbook sections</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              YouTube Video URL or Video ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                className="w-full bg-slate-950 text-xs px-3 py-2.5 rounded-xl border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-red-500"
              />
              <Link className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Lecture Title / Subject Topic
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. University Lecture / Topic Video"
              required
              className="w-full bg-slate-950 text-xs px-3 py-2.5 rounded-xl border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1 text-slate-400">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              Automatic Synchronization
            </div>
            <p className="text-[11px] leading-relaxed">
              When connected, the AI Tutor will track your video timestamps and connect video discussions with relevant textbook pages.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Connect Lecture</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
