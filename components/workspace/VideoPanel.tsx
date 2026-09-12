"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Youtube,
  Play,
  ExternalLink,
  BookOpen,
  Clock,
  Sparkles,
  Link as LinkIcon,
  CheckCircle2,
  Volume2,
  Share2,
} from "lucide-react";
import { VideoLecture, VideoTopic } from "@/types";
import { ConnectLectureModal } from "./ConnectLectureModal";

interface VideoPanelProps {
  video: VideoLecture;
  activePageNumber: number;
  onNavigateToTextbookPage: (page: number) => void;
  onAskAIAboutVideo: (topic: VideoTopic) => void;
  onUpdateVideo: (newVideo: VideoLecture) => void;
}

export const VideoPanel: React.FC<VideoPanelProps> = ({
  video,
  activePageNumber,
  onNavigateToTextbookPage,
  onAskAIAboutVideo,
  onUpdateVideo,
}) => {
  const [activeTopicIndex, setActiveTopicIndex] = useState<number>(2); // Default to TCP Handshake topic
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(240); // 04:00
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  const activeTopic = video.topics[activeTopicIndex] || video.topics[0];

  const handleTopicClick = (index: number) => {
    setActiveTopicIndex(index);
    const topic = video.topics[index];
    if (topic) {
      setCurrentTimestamp(topic.timestampSeconds);
      setIsPlaying(true);
    }
  };

  const handleConnectLecture = (url: string, customTitle: string) => {
    const match = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    );
    const videoId = match ? match[1] : "k9ZGsUR58SE";

    const updatedVideo: VideoLecture = {
      ...video,
      id: `vid-${Date.now()}`,
      title: customTitle,
      youtubeId: videoId,
      topics: [
        {
          timestampSeconds: 0,
          formattedTime: "00:00",
          title: "Introduction to Lecture",
          chapterId: "ch-3",
          pageNumber: 70,
          summary: "Lecture intro and core concepts overview.",
        },
        {
          timestampSeconds: 180,
          formattedTime: "03:00",
          title: "Core Mechanics & Demonstration",
          chapterId: "ch-3",
          pageNumber: 72,
          summary: "Detailed demonstration and whiteboard breakdown.",
        },
        {
          timestampSeconds: 420,
          formattedTime: "07:00",
          title: "Protocol Analysis & Summary",
          chapterId: "ch-3",
          pageNumber: 74,
          summary: "Wrap-up and practical engineering considerations.",
        },
      ],
    };

    onUpdateVideo(updatedVideo);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 border-b border-slate-800/80 overflow-hidden relative select-none">
      <ConnectLectureModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnectLecture={handleConnectLecture}
      />

      {/* Video Panel Top Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/95 border-b border-slate-800 text-xs backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <div className="p-1.5 rounded-lg bg-red-600/10 text-red-400 border border-red-500/20 flex items-center justify-center">
            <Youtube className="w-4 h-4" />
          </div>
          <div className="truncate">
            <span className="font-semibold text-slate-200 truncate block text-xs">
              {video.title}
            </span>
            <span className="text-[10px] text-slate-400 font-mono -mt-0.5 block">
              {video.channelName} • {video.formattedDuration}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsConnectModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-750 text-[11px] font-medium text-slate-300 hover:text-white transition-all border border-slate-700/60 shadow-sm"
            title="Connect another YouTube lecture"
          >
            <LinkIcon className="w-3 h-3 text-red-400" />
            <span className="hidden sm:inline">Connect Lecture</span>
          </button>
        </div>
      </div>

      {/* Main Video Body (Responsive Grid) */}
      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3 custom-scrollbar">
        {/* Responsive 16:9 Player Container */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl group">
          {isPlaying ? (
            <iframe
              src={`https://www.youtube.com/embed/${video.youtubeId}?start=${currentTimestamp}&autoplay=1&rel=0&modestbranding=1`}
              title={video.title}
              className="w-full h-full border-0 absolute inset-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div
              onClick={() => setIsPlaying(true)}
              className="w-full h-full relative cursor-pointer flex items-center justify-center bg-slate-950"
            >
              <Image
                src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
                alt={video.title}
                fill
                className="object-cover opacity-80 group-hover:opacity-95 transition-opacity"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              <div className="absolute w-14 h-14 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-950/60 group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 fill-white ml-0.5" />
              </div>
            </div>
          )}
        </div>

        {/* Video Topic Synchronization & AI Actions Bar */}
        <div className="p-3.5 bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-slate-800/90 rounded-2xl space-y-2.5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] text-indigo-400 font-semibold">
                <Clock className="w-3.5 h-3.5" />
                <span>Active Timestamp: {activeTopic.formattedTime}</span>
              </div>
              <h4 className="text-xs font-bold text-slate-100 mt-1">
                {activeTopic.title}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                {activeTopic.summary}
              </p>
            </div>

            {/* Sync Badge */}
            <div className="shrink-0 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono flex items-center gap-1 shadow-sm">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Synced with p.{activeTopic.pageNumber}</span>
            </div>
          </div>

          {/* Connected Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={() => onNavigateToTextbookPage(activeTopic.pageNumber)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-indigo-200 text-xs font-semibold transition-all shadow-sm"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Find this in Textbook (p.{activeTopic.pageNumber})</span>
            </button>

            <button
              onClick={() => onAskAIAboutVideo(activeTopic)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold transition-all border border-slate-700/60 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Ask AI about this moment</span>
            </button>
          </div>
        </div>

        {/* Lecture Chapter Markers & Synced Textbook Sections */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between px-1">
            <span>Lecture Timestamps & Textbook Links:</span>
            <span className="text-[10px] text-slate-500 font-mono">Click to jump</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {video.topics.map((t, idx) => (
              <button
                key={idx}
                onClick={() => handleTopicClick(idx)}
                className={`p-2.5 rounded-xl text-left border transition-all text-xs flex items-center justify-between ${
                  activeTopicIndex === idx
                    ? "bg-indigo-950/60 border-indigo-500/80 text-indigo-200 shadow-md shadow-indigo-950/40"
                    : "bg-slate-900/60 border-slate-800/60 text-slate-400 hover:bg-slate-850 hover:text-slate-200"
                }`}
              >
                <div className="truncate pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-slate-950 text-indigo-300 border border-slate-800 font-semibold">
                      {t.formattedTime}
                    </span>
                    <span className="truncate font-medium text-slate-200 text-[11px]">
                      {t.title}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-indigo-400/80 font-mono shrink-0 font-semibold">
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
