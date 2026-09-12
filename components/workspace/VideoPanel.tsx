"use client";

import React, { useState, useEffect } from "react";
import {
  Youtube,
  Play,
  ExternalLink,
  BookOpen,
  Clock,
  Sparkles,
  Link as LinkIcon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Trash2,
  FileText,
  AlertTriangle,
  Search,
  Plus,
  X,
} from "lucide-react";
import { VideoLecture, VideoTopic, VideoTranscriptSegment } from "@/types";
import { ConnectLectureModal } from "./ConnectLectureModal";

interface VideoPanelProps {
  video: VideoLecture | null;
  bookId?: string;
  activePageNumber: number;
  onNavigateToTextbookPage: (page: number) => void;
  onAskAIAboutVideo: (topic: VideoTopic | VideoTranscriptSegment) => void;
  onUpdateVideo: (newVideo: VideoLecture | null) => void;
  seekTimestamp?: number | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const VideoPanel: React.FC<VideoPanelProps> = ({
  video,
  bookId,
  activePageNumber,
  onNavigateToTextbookPage,
  onAskAIAboutVideo,
  onUpdateVideo,
  seekTimestamp,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(0);
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState<boolean>(false);
  const [transcriptSearch, setTranscriptSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync seekTimestamp if changed from external (e.g. AI citation click)
  useEffect(() => {
    if (seekTimestamp !== undefined && seekTimestamp !== null) {
      setCurrentTimestamp(seekTimestamp);
    }
  }, [seekTimestamp]);

  const handleConnectLecture = async (url: string, customTitle: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    if (!bookId) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/books/${bookId}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl: url,
          title: customTitle,
        }),
      });
      const data = await res.json();
      if (res.ok && data.video) {
        onUpdateVideo(data.video);
        setCurrentTimestamp(0);
      } else {
        setErrorMessage(data.error || "Failed to connect YouTube video.");
      }
    } catch (err: any) {
      console.warn("Failed to persist video on server:", err);
      setErrorMessage("Network error while connecting video lecture.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectVideo = async () => {
    if (!bookId || !video) return;
    try {
      await fetch(`/api/books/${bookId}/video?videoId=${encodeURIComponent(video.id)}`, {
        method: "DELETE",
      });
      onUpdateVideo(null);
    } catch (err) {
      console.warn("Failed to disconnect video:", err);
    }
  };

  const filteredTranscripts = (video?.transcript || []).filter((seg) =>
    transcriptSearch ? seg.text.toLowerCase().includes(transcriptSearch.toLowerCase()) : true
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080c14] text-slate-200 overflow-hidden relative">
      
      {/* ========================================================================= */}
      {/* Video Panel Top Header Bar */}
      {/* ========================================================================= */}
      <div className="h-11 bg-[#0c121e] border-b border-slate-800 px-3 md:px-4 flex items-center justify-between shrink-0 select-none z-10 text-xs">
        
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
            <Youtube className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-white truncate max-w-[200px] md:max-w-[280px]">
              {video ? video.title : "Linked Video Lecture"}
            </span>
            {video?.channelName && (
              <span className="text-[11px] text-slate-400 hidden sm:inline truncate">
                • {video.channelName}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {video && (
            <>
              {/* Transcript Status Badge & Drawer Toggle */}
              {video.transcript && video.transcript.length > 0 ? (
                <button
                  onClick={() => setShowTranscriptDrawer(!showTranscriptDrawer)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    showTranscriptDrawer
                      ? "bg-indigo-600 text-white"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span className="hidden sm:inline">Transcript</span>
                  <span className="font-mono">({video.transcript.length})</span>
                </button>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700/60">
                  Transcript Unavailable
                </span>
              )}

              {/* Replace Video */}
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="px-2 py-0.5 rounded text-[11px] text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                title="Replace Video URL"
              >
                Replace
              </button>

              {/* Unlink Video */}
              <button
                onClick={handleDisconnectVideo}
                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Disconnect Video"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Connect Video if none attached */}
          {!video && (
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect Lecture</span>
            </button>
          )}

          {/* Collapse/Expand Panel Toggle */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
              title={isCollapsed ? "Expand Video" : "Collapse Video"}
            >
              {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* Video Content Area */}
      {/* ========================================================================= */}
      {!isCollapsed && (
        <div className="flex-1 flex flex-col overflow-hidden bg-black relative">
          {video ? (
            <div className="flex-1 w-full h-full relative flex items-center justify-center bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?enablejsapi=1&start=${currentTimestamp}&rel=0`}
                title={video.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-[#0a0e18]">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                <Youtube className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-slate-200">No YouTube Lecture Connected</h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  Paste a YouTube lecture URL to sync timestamped transcripts and enable video-grounded AI tutoring.
                </p>
              </div>
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Connect YouTube Lecture</span>
              </button>
            </div>
          )}

          {/* Transcript Drawer Overlay */}
          {showTranscriptDrawer && video?.transcript && (
            <div className="absolute inset-y-0 right-0 w-80 bg-[#0c121e]/95 backdrop-blur-md border-l border-slate-800 z-20 flex flex-col shadow-2xl animate-in slide-in-from-right duration-150">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Video Transcript</h4>
                </div>
                <button onClick={() => setShowTranscriptDrawer(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search transcript */}
              <div className="p-2.5 border-b border-slate-800/80 bg-slate-950/40">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                    placeholder="Search in transcript..."
                    className="w-full pl-8 pr-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Segments List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar text-xs">
                {filteredTranscripts.length > 0 ? (
                  filteredTranscripts.map((seg, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded bg-slate-900/80 border border-slate-800/80 space-y-1 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setCurrentTimestamp(seg.timestampSeconds)}
                          className="font-mono text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>{seg.formattedTime}</span>
                        </button>
                        <button
                          onClick={() => onAskAIAboutVideo(seg)}
                          className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                          title="Ask AI about this moment"
                        >
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span>Ask AI</span>
                        </button>
                      </div>
                      <p className="text-slate-300 text-xs leading-relaxed">{seg.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    {transcriptSearch ? "No matches found in transcript." : "No transcript segments available."}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connect Lecture Modal */}
      {isConnectModalOpen && (
        <ConnectLectureModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
          onConnectLecture={handleConnectLecture}
        />
      )}

    </div>
  );
};
