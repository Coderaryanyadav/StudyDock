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
  video: VideoLecture;
  activePageNumber: number;
  onNavigateToTextbookPage: (page: number) => void;
  onAskAIAboutVideo: (topic: VideoTopic) => void;
  onUpdateVideo: (newVideo: VideoLecture) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const VideoPanel: React.FC<VideoPanelProps> = ({
  video,
  activePageNumber,
  onNavigateToTextbookPage,
  onAskAIAboutVideo,
  onUpdateVideo,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [activeTopicIndex, setActiveTopicIndex] = useState<number>(2); // Default to TCP Handshake topic
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(240); // 04:00
  const [showAllTopics, setShowAllTopics] = useState<boolean>(false);
  const [useDirectPlayer, setUseDirectPlayer] = useState<boolean>(true);

  const activeTopic = video.topics[activeTopicIndex] || video.topics[0];

  const handleTopicClick = (index: number) => {
    setActiveTopicIndex(index);
    const topic = video.topics[index];
    if (topic) {
      setCurrentTimestamp(topic.timestampSeconds);
    }
  };

  const handleConnectLecture = (url: string, customTitle: string) => {
    const match = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    );
    const videoId = match ? match[1] : "7_LPdttKXPc";

    const updatedVideo: VideoLecture = {
      ...video,
      id: `vid-${Date.now()}`,
      title: customTitle,
      youtubeId: videoId,
      topics: [
        {
          timestampSeconds: 0,
          formattedTime: "00:00",
          title: "Lecture Intro & Foundations",
          chapterId: "ch-3",
          pageNumber: 70,
          summary: "Lecture overview and core concepts.",
        },
        {
          timestampSeconds: 180,
          formattedTime: "03:00",
          title: "TCP 3-Way Handshake Deep Dive",
          chapterId: "ch-3",
          pageNumber: 72,
          summary: "SYN, SYN-ACK, ACK packet traces.",
        },
        {
          timestampSeconds: 420,
          formattedTime: "07:00",
          title: "Flow Control & Buffer Management",
          chapterId: "ch-3",
          pageNumber: 73,
          summary: "Receiver window (rwnd) mechanics.",
        },
      ],
    };

    onUpdateVideo(updatedVideo);
  };

  if (isCollapsed) {
    return (
      <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center justify-between text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-red-600/20 text-red-400">
            <Youtube className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium text-slate-300 truncate max-w-xs">
            🎥 Video: {video.title} ({activeTopic.formattedTime})
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

        {/* Compact Synchronized Topic & Actions Bar */}
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

        {/* Lecture Chapter Markers (Compact Grid) */}
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
      </div>
    </div>
  );
};
