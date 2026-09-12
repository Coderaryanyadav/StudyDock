"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  BookOpen,
  ArrowRight,
  RotateCcw,
  Lightbulb,
  Layers,
  GraduationCap,
  FileText,
  HelpCircle,
  Compass,
  Brain,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import { Book, ChatMessage, Citation, LearningMode, VideoLecture } from "@/types";
import { LEARNING_MODES } from "@/lib/learning-modes";
import { renderMathInText } from "@/lib/katex-renderer";

interface AITutorPanelProps {
  book: Book;
  activePageNumber: number;
  activeVideo: VideoLecture;
  onNavigateToTextbookPage: (page: number) => void;
  externalPrompt?: { text: string; mode?: LearningMode; selectedText?: string } | null;
  onClearExternalPrompt?: () => void;
  onLaunchQuizFromAI?: () => void;
  onLaunchFlashcardsFromAI?: () => void;
}

export const AITutorPanel: React.FC<AITutorPanelProps> = ({
  book,
  activePageNumber,
  activeVideo,
  onNavigateToTextbookPage,
  externalPrompt,
  onClearExternalPrompt,
  onLaunchQuizFromAI,
  onLaunchFlashcardsFromAI,
}) => {
  const [learningMode, setLearningMode] = useState<LearningMode>("explain");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "ai",
      content: `Hello! I'm your **AI Academic Tutor** for *${book.title}*.\n\nI'm currently tracking your progress on **Page ${activePageNumber}** (*${
        book.pages.find((p) => p.pageNumber === activePageNumber)?.sectionTitle || "Transport Layer"
      }*).\n\nAsk me anything about the textbook, video lectures, or select any text on the left to get instant breakdowns!`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      suggestedFollowUps: [
        "Why does TCP need three messages?",
        "Explain flow control and rwnd",
        "Give me an exam-style quiz",
      ],
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Handle external prompt passed from textbook selection or video button
  useEffect(() => {
    if (externalPrompt) {
      if (externalPrompt.mode) {
        setLearningMode(externalPrompt.mode);
      }
      handleSendMessage(externalPrompt.text, externalPrompt.mode || learningMode, externalPrompt.selectedText);
      if (onClearExternalPrompt) onClearExternalPrompt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPrompt]);

  const handleSendMessage = async (
    textToSend?: string,
    overrideMode?: LearningMode,
    selectedTextContext?: string
  ) => {
    const question = (textToSend || inputQuestion).trim();
    if (!question || isStreaming) return;

    const currentMode = overrideMode || learningMode;
    const userMsgId = `user-${Date.now()}`;
    const aiMsgId = `ai-${Date.now()}`;

    const activePageObj = book.pages.find((p) => p.pageNumber === activePageNumber);

    const newUserMessage: ChatMessage = {
      id: userMsgId,
      sender: "user",
      content: question,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      learningMode: currentMode,
      contextSnapshot: {
        bookTitle: book.title,
        chapterTitle: activePageObj?.chapterTitle || "Chapter 3: Transport Layer",
        sectionTitle: activePageObj?.sectionTitle || "3.3 Handshake",
        pageNumber: activePageNumber,
        selectedText: selectedTextContext,
      },
    };

    const initialAiMessage: ChatMessage = {
      id: aiMsgId,
      sender: "ai",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      learningMode: currentMode,
      isStreaming: true,
    };

    setMessages((prev) => [...prev, newUserMessage, initialAiMessage]);
    setInputQuestion("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          pageNumber: activePageNumber,
          selectedText: selectedTextContext,
          learningMode: currentMode,
          videoTimestampSeconds: 240,
          bookId: book.id,
        }),
      });

      if (!response.body) throw new Error("No response stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let citations: Citation[] = [];
      let followUps: string[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "chunk") {
                accumulatedText = data.text;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMsgId ? { ...msg, content: accumulatedText } : msg
                  )
                );
              } else if (data.type === "done") {
                accumulatedText = data.fullText || accumulatedText;
                citations = data.citations || [];
                followUps = data.suggestedFollowUps || [];
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMsgId
                      ? {
                          ...msg,
                          content: accumulatedText,
                          isStreaming: false,
                          citations,
                          suggestedFollowUps: followUps,
                        }
                      : msg
                  )
                );
              }
            } catch (err) {
              // Ignore partial JSON parse chunks
            }
          }
        }
      }
    } catch (error) {
      console.error("Streaming error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId
            ? {
                ...msg,
                content:
                  "I apologize, but I encountered a network error while retrieving your answer. Please try asking again.",
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeModeConfig = LEARNING_MODES[learningMode] || LEARNING_MODES.explain;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* AI Tutor Header with Mode Selector & Active Context Badge */}
      <div className="px-3 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-100">AI Academic Tutor</span>
              <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-mono">
                Context-Aware
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <span>Grounded on:</span>
              <span className="text-slate-300 font-medium truncate max-w-[180px]">
                p.{activePageNumber} ({book.pages.find((p) => p.pageNumber === activePageNumber)?.sectionTitle || "Transport Layer"})
              </span>
            </div>
          </div>
        </div>

        {/* Learning Mode Dropdown / Selector */}
        <div className="flex items-center gap-1.5">
          <div className="relative inline-block">
            <select
              value={learningMode}
              onChange={(e) => setLearningMode(e.target.value as LearningMode)}
              className="appearance-none bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs pl-2.5 pr-7 py-1.5 rounded-xl border border-slate-700/80 focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
            >
              <option value="explain">✨ Explain</option>
              <option value="beginner">👶 Beginner</option>
              <option value="deep_dive">🔬 Deep Dive</option>
              <option value="example">🧪 Example</option>
              <option value="quiz">❓ Quiz</option>
              <option value="exam">🎓 Exam Mode</option>
              <option value="flashcards">📇 Flashcards</option>
              <option value="summary">📝 Summary</option>
              <option value="teach_me">🧭 Teach Me</option>
              <option value="socratic">🧠 Socratic Mode</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((message) => {
          const isAi = message.sender === "ai";
          return (
            <div
              key={message.id}
              className={`flex gap-3 animate-in fade-in duration-200 ${
                isAi ? "items-start" : "items-start flex-row-reverse"
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-semibold ${
                  isAi
                    ? "bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-md shadow-indigo-900/30"
                    : "bg-slate-800 text-slate-300 border border-slate-700"
                }`}
              >
                {isAi ? <Sparkles className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>

              {/* Message Content Bubble */}
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed space-y-2 relative group shadow-sm ${
                  isAi
                    ? "bg-slate-900 border border-slate-800 text-slate-200"
                    : "bg-indigo-600 text-white font-normal"
                }`}
              >
                {/* Context badge for user messages */}
                {!isAi && message.contextSnapshot && (
                  <div className="text-[10px] text-indigo-200 pb-1 mb-1 border-b border-indigo-500/40 flex items-center justify-between">
                    <span>From p.{message.contextSnapshot.pageNumber}</span>
                    {message.learningMode && (
                      <span className="uppercase font-mono tracking-wider">
                        {message.learningMode}
                      </span>
                    )}
                  </div>
                )}

                {/* Selected text quote if any */}
                {!isAi && message.contextSnapshot?.selectedText && (
                  <div className="p-2 bg-indigo-700/60 rounded-lg text-[11px] italic border-l-2 border-amber-300 text-indigo-100">
                    &ldquo;{message.contextSnapshot.selectedText}&rdquo;
                  </div>
                )}

                {/* Message Body */}
                <div className="prose prose-invert prose-indigo max-w-none text-xs leading-relaxed">
                  {message.isStreaming && !message.content ? (
                    <div className="flex items-center gap-1.5 text-indigo-400 py-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />
                      <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                      <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
                      <span className="text-[11px] text-slate-400 ml-1">Analyzing textbook context...</span>
                    </div>
                  ) : (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: formatAiResponseHtml(message.content, onNavigateToTextbookPage),
                      }}
                    />
                  )}
                </div>

                {/* Citations Box (Clickable to jump to textbook page) */}
                {isAi && message.citations && message.citations.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-slate-800 space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-indigo-400" />
                      <span>Verified Citations:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {message.citations.map((cite) => (
                        <button
                          key={cite.id}
                          onClick={() => onNavigateToTextbookPage(cite.pageNumber)}
                          className="px-2 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/40 text-indigo-300 text-[10px] font-medium transition-colors flex items-center gap-1"
                          title={cite.excerpt}
                        >
                          <span>📖 {cite.bookTitle} — Page {cite.pageNumber}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-indigo-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up Quick Action Chips on AI Responses */}
                {isAi && !message.isStreaming && (
                  <div className="pt-2 mt-1 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => handleSendMessage("Explain this simpler with a real-life analogy", "beginner")}
                      className="px-2 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-[10px] text-slate-300 hover:text-white transition-colors border border-slate-700/60 flex items-center gap-1"
                    >
                      <Lightbulb className="w-2.5 h-2.5 text-amber-400" />
                      <span>Explain simpler</span>
                    </button>

                    <button
                      onClick={() => handleSendMessage("Give a concrete real-world example with packet trace", "example")}
                      className="px-2 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-[10px] text-slate-300 hover:text-white transition-colors border border-slate-700/60 flex items-center gap-1"
                    >
                      <Layers className="w-2.5 h-2.5 text-cyan-400" />
                      <span>Give example</span>
                    </button>

                    {onLaunchQuizFromAI && (
                      <button
                        onClick={onLaunchQuizFromAI}
                        className="px-2 py-1 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 text-[10px] text-indigo-300 hover:text-indigo-200 transition-colors border border-indigo-500/30 flex items-center gap-1"
                      >
                        <HelpCircle className="w-2.5 h-2.5 text-indigo-400" />
                        <span>Quiz me</span>
                      </button>
                    )}

                    {onLaunchFlashcardsFromAI && (
                      <button
                        onClick={onLaunchFlashcardsFromAI}
                        className="px-2 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-[10px] text-slate-300 hover:text-white transition-colors border border-slate-700/60 flex items-center gap-1"
                      >
                        <BookOpen className="w-2.5 h-2.5 text-rose-400" />
                        <span>Flashcards</span>
                      </button>
                    )}

                    <button
                      onClick={() => copyToClipboard(message.content, message.id)}
                      className="ml-auto p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                      title="Copy response"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts Bar */}
      <div className="px-3 py-1.5 bg-slate-900/60 border-t border-slate-800/60 flex items-center gap-1.5 overflow-x-auto text-[11px] custom-scrollbar shrink-0">
        <span className="text-slate-500 text-[10px] uppercase font-semibold shrink-0">
          Suggested:
        </span>
        <button
          onClick={() => handleSendMessage("Why does TCP need three messages?", "explain")}
          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white shrink-0 border border-slate-700/50 transition-colors"
        >
          Why 3 messages for TCP?
        </button>
        <button
          onClick={() => handleSendMessage("Explain flow control and the rwnd buffer equation", "deep_dive")}
          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white shrink-0 border border-slate-700/50 transition-colors"
        >
          Flow control & rwnd
        </button>
        <button
          onClick={() => handleSendMessage("What should I remember for my exam from this section?", "exam")}
          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white shrink-0 border border-slate-700/50 transition-colors"
        >
          Exam review points
        </button>
        <button
          onClick={() => handleSendMessage("Quiz me on this chapter", "quiz")}
          className="px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 shrink-0 border border-indigo-500/30 transition-colors"
        >
          Quiz me
        </button>
      </div>

      {/* Bottom Input Area */}
      <div className="p-3 bg-slate-900/90 border-t border-slate-800 shrink-0 backdrop-blur-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask your tutor anything about p.${activePageNumber} or press Enter...`}
            disabled={isStreaming}
            className="w-full bg-slate-950 text-xs px-3.5 py-2.5 pr-10 rounded-xl border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none transition-colors"
          />

          <button
            type="submit"
            disabled={!inputQuestion.trim() || isStreaming}
            className="absolute right-2 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white transition-colors"
            title="Send question (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * Formats AI markdown responses, highlighting Source citations with custom interactive buttons
 */
function formatAiResponseHtml(
  content: string,
  onNavigate: (page: number) => void
): string {
  let html = content
    // Headings
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-indigo-300 mt-2.5 mb-1">$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4 class="text-xs font-semibold text-slate-200 mt-2 mb-1">$1</h4>')
    // Code blocks
    .replace(
      /```(\w*)([\s\S]*?)```/gm,
      '<pre class="p-3 bg-slate-950 rounded-xl border border-slate-800 text-indigo-300 font-mono text-[11px] leading-tight overflow-x-auto my-2">$2</pre>'
    )
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-slate-800 text-indigo-300 rounded font-mono text-[11px]">$1</code>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-100 font-semibold">$1</strong>')
    // Italics
    .replace(/\*(.*?)\*/g, '<em class="text-slate-300 italic">$1</em>')
    // Bullet points
    .replace(/^\* (.*$)/gim, '<li class="ml-3 list-disc text-slate-300">$1</li>')
    .replace(/^- (.*$)/gim, '<li class="ml-3 list-disc text-slate-300">$1</li>');

  return renderMathInText(html);
}
