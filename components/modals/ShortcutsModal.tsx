"use client";

import React from "react";
import { X, Keyboard, Command } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "Cmd/Ctrl + K", description: "Search in Textbook & Workspace" },
    { key: "Cmd/Ctrl + /", description: "Focus AI Tutor Chat input" },
    { key: "← / →", description: "Navigate to Previous / Next page" },
    { key: "Cmd/Ctrl + B", description: "Toggle Table of Contents drawer" },
    { key: "Cmd/Ctrl + D", description: "Toggle Study Dashboard" },
    { key: "Cmd/Ctrl + Shift + T", description: "Toggle AI Tutor panel" },
    { key: "Cmd/Ctrl + Shift + V", description: "Toggle Video Lecture panel" },
    { key: "?", description: "Open this Keyboard Shortcuts help" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Keyboard Shortcuts</h3>
              <p className="text-xs text-slate-400">Power navigation commands for desktop</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs"
            >
              <span className="text-slate-300">{s.description}</span>
              <kbd className="px-2 py-1 rounded-lg bg-slate-800 text-indigo-300 font-mono text-[11px] border border-slate-700">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="text-center pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
