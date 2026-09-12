"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Youtube,
  Play,
  Pause,
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
} from "lucide-react";
import { VideoLecture, VideoTopic } from "@/types";
import { ConnectLectureModal } from "./ConnectLectureModal";

interface VideoPanelProps {
  video: VideoLecture | null;
  bookId?: string;
  activePageNumber: number;
  onNavigateToTextbookPage: (page: number) => void;
  onAskAIAboutVideo: (topic: VideoTopic) => void;
  onUpdateVideo: (newVideo: VideoLecture) => void;
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
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [activeTopicIndex, setActiveTopicIndex] = useState<number>(0);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(0);
  const [showAllTopics, setShowAllTopics] = useState<boolean>(false);

  const activeTopic = video?.topics && video.topics.length > 0
    ? video.topics[activeTopicIndex] || video.topics[0]
    : null;

  const handleTopicClick = (index: number) => {
    setActiveTopicIndex(index);
    if (video?.topics && video.topics[index]) {
      setCurrentTimestamp(video.topics[index].timestampSeconds);
    }
  };

  const handleConnectLecture = async (url: string, customTitle: string) => {
    const match = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    );
    if (!match) {
      alert("Please provide a valid 11-character YouTube video URL.");
      return;
    }
    const videoId = match[1];

    if (bookId) {
      try {
        const res = await fetch(`/api/books/${bookId}/video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            youtubeUrl: url,
            title: customTitle || `YouTube Lecture (${videoId})`,
          }),
        });
        const data = await res.json();
        if (res.ok && data.video) {
          onUpdateVideo(data.video);
          return;
        }
      } catch (err) {
        console.warn("Failed to persist video on server:", err);
      }
    }

    const newVideo: VideoLecture = {
      id: `vid-${videoId}`,
      title: customTitle || `YouTube Lecture (${videoId})`,
      youtubeId: videoId,
      channelName: null,
      durationSeconds: 0,
      formattedDuration: "00:00",
      bookId: bookId || "",
      topics: [],
    };

    onUpdateVideo(newVideo);
  };

  if (isCollapsed) {
    return (
      <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center justify-between text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-red-600/20 text-red-400">
            <Youtube className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium text-slate-300 truncate max-w-xs">
            🎥 Video: {video ? video.title : "No lecture attached"}
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
        >
          <span>Expand Video</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex flex-col h-full bg-slate-950 text-slate-100 border-b border-slate-800/80 overflow-hidden relative select-none">
        <ConnectLectureModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
          onConnectLecture={handleConnectLecture}
        />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-600/10 border border-red-500/20 text-red-400 flex items-center justify-center">
            <Youtube className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-xs text-slate-200">No Lecture Connected</h4>
            <p className="text-[11px] text-slate-400 max-w-xs">
              Attach a YouTube video lecture related to this textbook to study alongside video explanations.
            </p>
          </div>
          <button
            onClick={() => setIsConnectModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md transition-colors flex items-center gap-1.5"
          >
            <Youtube className="w-3.5 h-3.5" />
            <span>Connect YouTube Lecture</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 border-b border-slate-800/80 overflow-hidden relative select-none">
      <ConnectLectureModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnectLecture={handleConnectLecture}
      />

      {/* Video Panel Top Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/95 border-b border-slate-800 text-xs backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <div className="p-1 rounded bg-red-600/10 text-red-400 border border-red-500/20 shrink-0">
            <Youtube className="w-3.5 h-3.5" />
          </div>
          <div className="truncate">
            <span className="font-semibold text-slate-200 truncate block text-xs">
              {video.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsConnectModalOpen(true)}
            className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-medium text-slate-300 hover:text-white transition-all border border-slate-700/60"
            title="Connect another YouTube lecture"
          >
            Connect
          </button>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Minimize Video Panel"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Video Body */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
        {/* Responsive Player Box with automatic aspect ratio */}
        <div className="relative w-full max-h-[210px] aspect-video mx-auto rounded-xl overflow-hidden bg-black border border-slate-800 shadow-lg group">
          <iframe
            src={`https://www.youtube.com/embed/${video.youtubeId}?start=${currentTimestamp}&rel=0&modestbranding=1`}
            title={video.title}
            className="w-full h-full border-0 absolute inset-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        {/* Synchronized Topic & Actions Bar if topics exist */}
        {activeTopic ? (
          <div className="p-2.5 bg-slate-900/90 border border-slate-800/90 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-200 truncate">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-bold shrink-0">
                  {activeTopic.formattedTime}
                </span>
                <span className="truncate">{activeTopic.title}</span>
              </div>

              <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>p.{activeTopic.pageNumber}</span>
              </span>
            </div>

            {/* Connected Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
              <button
                onClick={() => onNavigateToTextbookPage(activeTopic.pageNumber)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-[11px] font-medium transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                <span>Find in Textbook (p.{activeTopic.pageNumber})</span>
              </button>

              <button
                onClick={() => onAskAIAboutVideo(activeTopic)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors border border-slate-700/60"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Ask AI</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-2.5 bg-slate-900/60 border border-slate-800/60 rounded-xl text-center text-xs text-slate-400">
            <span>Video synced with study workspace</span>
          </div>
        )}

        {/* Lecture Chapter Markers (if topics available) */}
        {video.topics && video.topics.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">
              <span>Lecture Timestamps:</span>
              <button
                onClick={() => setShowAllTopics(!showAllTopics)}
                className="text-indigo-400 hover:underline normal-case text-[10px]"
              >
                {showAllTopics ? "Show less" : `View all (${video.topics.length})`}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1">
              {(showAllTopics ? video.topics : video.topics.slice(0, 4)).map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTopicClick(idx)}
                  className={`p-1.5 rounded-lg text-left border transition-all text-xs flex items-center justify-between ${
                    activeTopicIndex === idx
                      ? "bg-indigo-950/60 border-indigo-500/80 text-indigo-200 shadow-sm"
                      : "bg-slate-900/50 border-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <span className="truncate text-[10px] font-medium text-slate-200 pr-1">
                    {t.formattedTime} {t.title}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono shrink-0">
                    p.{t.pageNumber}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
