"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  BookOpen,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  ChevronDown,
  MessageSquare,
  Compass,
  ExternalLink,
} from "lucide-react";
import { Book, ChatMessage, Citation, LearningMode, VideoLecture } from "@/types";
import { LEARNING_MODES } from "@/lib/learning-modes";
import { renderMathInText } from "@/lib/katex-renderer";

interface ConversationItem {
  id: string;
  title: string;
  createdAt: string;
}

interface AITutorPanelProps {
  book: Book;
  activePageNumber: number;
  activeVideo: VideoLecture | null;
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
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showConvDropdown, setShowConvDropdown] = useState<boolean>(false);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState<string>("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // 1. Load conversations list & latest conversation history
  const loadConversations = async (targetConvId?: string) => {
    if (!book?.id) return;
    try {
      const res = await fetch(`/api/chat?bookId=${encodeURIComponent(book.id)}&list=true`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.conversations)) {
        setConversations(data.conversations);

        const convToLoad = targetConvId || (data.conversations.length > 0 ? data.conversations[0].id : null);
        if (convToLoad) {
          loadConversationHistory(convToLoad);
        } else {
          setActiveConversationId(null);
          setMessages([
            {
              id: `msg-welcome-${book.id}`,
              sender: "ai",
              content: `Hello! I'm your private **AI Academic Tutor** for *${book.title}*.\n\nAsk me anything about your textbook, or select text in the PDF reader to get deep-dive explanations!`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              suggestedFollowUps: [
                "Summarize the key concepts on this page",
                "Explain this in simple terms with an analogy",
                "Generate practice questions from this section",
              ],
            },
          ]);
        }
      }
    } catch (err) {
      console.warn("Failed to load conversations list:", err);
    }
  };

  const loadConversationHistory = async (convId: string) => {
    if (!book?.id || !convId) return;
    try {
      setActiveConversationId(convId);
      const res = await fetch(`/api/chat?bookId=${encodeURIComponent(book.id)}&conversationId=${encodeURIComponent(convId)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          setMessages([
            {
              id: `msg-welcome-${convId}`,
              sender: "ai",
              content: `Started new conversation for *${book.title}*. How can I help you study?`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              suggestedFollowUps: [
                "Explain the main concepts",
                "Give a beginner breakdown",
              ],
            },
          ]);
        }
      }
    } catch (err) {
      console.warn("Failed to load conversation history:", err);
    }
  };

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id]);

  useEffect(() => {
    if (messages.length > 1 || isStreaming) {
      scrollToBottom();
    }
  }, [messages.length, isStreaming]);

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

  const handleCreateNewChat = async () => {
    if (!book?.id) return;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_conversation",
          bookId: book.id,
          title: `Chat ${conversations.length + 1}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.conversation) {
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConversationId(data.conversation.id);
        setMessages([
          {
            id: `msg-welcome-${data.conversation.id}`,
            sender: "ai",
            content: `New chat session started for *${book.title}*. Ask me any question from your reading!`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setShowConvDropdown(false);
      }
    } catch (err) {
      console.warn("Failed to create new conversation:", err);
    }
  };

  const handleRenameConversation = async (convId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, title: newTitle.trim() }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: newTitle.trim() } : c))
        );
        setEditingConvId(null);
      }
    } catch (err) {
      console.warn("Failed to rename conversation:", err);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation thread?")) return;
    try {
      const res = await fetch(`/api/chat?conversationId=${encodeURIComponent(convId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const remaining = conversations.filter((c) => c.id !== convId);
        setConversations(remaining);
        if (activeConversationId === convId) {
          if (remaining.length > 0) {
            loadConversationHistory(remaining[0].id);
          } else {
            handleCreateNewChat();
          }
        }
      }
    } catch (err) {
      console.warn("Failed to delete conversation:", err);
    }
  };

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
        chapterTitle: activePageObj?.chapterTitle || "",
        sectionTitle: activePageObj?.sectionTitle || activePageObj?.title || `Page ${activePageNumber}`,
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
          videoTimestampSeconds: undefined,
          bookId: book.id,
          conversationId: activeConversationId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to connect to StudyDock AI.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          if (value) {
            const rawChunk = decoder.decode(value, { stream: true });
            const lines = rawChunk.split("\n\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.replace("data: ", ""));
                  if (data.type === "chunk" && data.text) {
                    accumulatedText += data.text;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === aiMsgId ? { ...m, content: accumulatedText } : m
                      )
                    );
                  } else if (data.type === "done") {
                    if (data.conversationId && data.conversationId !== activeConversationId) {
                      setActiveConversationId(data.conversationId);
                      // Update conversations list if new
                      setConversations((prev) => {
                        if (!prev.some((c) => c.id === data.conversationId)) {
                          return [
                            {
                              id: data.conversationId,
                              title: question.slice(0, 45),
                              createdAt: new Date().toISOString(),
                            },
                            ...prev,
                          ];
                        }
                        return prev;
                      });
                    }

                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === aiMsgId
                          ? {
                              ...m,
                              content: data.fullText || accumulatedText,
                              isStreaming: false,
                              citations: data.citations || [],
                              suggestedFollowUps: data.suggestedFollowUps || [],
                            }
                          : m
                      )
                    );
                  } else if (data.type === "error") {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === aiMsgId
                          ? {
                              ...m,
                              content: data.error || "Failed to generate tutor response.",
                              isStreaming: false,
                            }
                          : m
                      )
                    );
                  }
                } catch (e) {
                  // parse error
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: "I couldn't process your question right now. Please verify your connection and try again.",
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRetryLastMessage = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.sender === "user");
    if (lastUserMsg) {
      handleSendMessage(lastUserMsg.content, lastUserMsg.learningMode || learningMode);
    }
  };

  const currentConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 border-l border-slate-800/80 overflow-hidden relative select-text">
      {/* AI Tutor Header with Multi-Conversation Selector */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 z-20 backdrop-blur-sm">
        {/* Left: Active Conversation Dropdown & New Chat */}
        <div className="flex items-center gap-2 relative">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Bot className="w-4 h-4" />
            </div>

            {/* Conversation Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowConvDropdown(!showConvDropdown)}
                className="flex items-center gap-1 text-xs font-bold text-white hover:text-indigo-300 transition-colors max-w-[160px] truncate"
              >
                <span className="truncate">{currentConv?.title || "Academic Chat"}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {showConvDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-400">Conversations</span>
                    <button
                      onClick={handleCreateNewChat}
                      className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Chat</span>
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar">
                    {conversations.map((conv) => {
                      const isActive = conv.id === activeConversationId;
                      return (
                        <div
                          key={conv.id}
                          onClick={() => {
                            loadConversationHistory(conv.id);
                            setShowConvDropdown(false);
                          }}
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                            isActive
                              ? "bg-indigo-600/25 text-indigo-300 font-semibold"
                              : "text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate flex-1 mr-2">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {editingConvId === conv.id ? (
                              <input
                                type="text"
                                value={editTitleInput}
                                onChange={(e) => setEditTitleInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleRenameConversation(conv.id, editTitleInput);
                                  }
                                }}
                                onBlur={() => handleRenameConversation(conv.id, editTitleInput)}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                className="bg-slate-950 px-1.5 py-0.5 rounded text-xs text-white border border-slate-700 w-full"
                              />
                            ) : (
                              <span className="truncate">{conv.title}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingConvId(conv.id);
                                setEditTitleInput(conv.title);
                              }}
                              className="p-1 hover:text-indigo-300 text-slate-400 rounded"
                              title="Rename conversation"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteConversation(e, conv.id)}
                              className="p-1 hover:text-rose-400 text-slate-400 rounded"
                              title="Delete conversation"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleCreateNewChat}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Start a new chat conversation"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Learning Mode Selector */}
        <div className="flex items-center gap-1.5">
          <select
            value={learningMode}
            onChange={(e) => setLearningMode(e.target.value as LearningMode)}
            className="bg-slate-950 text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-indigo-500 font-medium"
          >
            {Object.values(LEARNING_MODES).map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Chat Message Stream */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs"
      >
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} animate-in fade-in duration-150`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 space-y-2 shadow-sm ${
                  isUser
                    ? "bg-indigo-600 text-white rounded-br-none"
                    : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
                }`}
              >
                {/* Header info */}
                <div className="flex items-center justify-between text-[10px] opacity-70 gap-3 border-b border-white/10 pb-1">
                  <span className="font-semibold uppercase tracking-wider">
                    {isUser ? "You" : "StudyDock AI Tutor"}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Message Content with math rendering */}
                <div className="prose prose-invert prose-indigo max-w-none text-xs leading-relaxed whitespace-pre-wrap">
                  {renderMathInText(msg.content)}
                </div>

                {/* Grounded Textbook Citations */}
                {!isUser && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="text-[10px] font-bold text-indigo-300 flex items-center gap-1 uppercase tracking-wider">
                      <BookOpen className="w-3 h-3" />
                      <span>Verified Sources:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.citations.map((cite) => (
                        <button
                          key={cite.id}
                          onClick={() => onNavigateToTextbookPage(cite.pageNumber)}
                          className="px-2 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-200 text-[11px] font-medium flex items-center gap-1.5 transition-colors group shadow-sm"
                          title={cite.excerpt}
                        >
                          <span className="font-mono text-indigo-400 font-bold">p.{cite.pageNumber}</span>
                          <span className="text-slate-300 truncate max-w-[140px]">{cite.section || cite.chapter}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-indigo-400 opacity-60 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Follow-up Pills */}
                {!isUser && msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                    {msg.suggestedFollowUps.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(suggestion)}
                        className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 border border-slate-700 text-[10px] transition-colors"
                      >
                        {suggestion} →
                      </button>
                    ))}
                  </div>
                )}

                {/* Message Actions */}
                {!isUser && !msg.isStreaming && (
                  <div className="flex items-center justify-end gap-1.5 pt-1 text-slate-400">
                    <button
                      onClick={() => handleCopyText(msg.id, msg.content)}
                      className="p-1 hover:text-slate-200 rounded transition-colors"
                      title="Copy message"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Input Composer */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 z-20 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium text-slate-300">Grounded in {book.title} (Page {activePageNumber})</span>
          </div>
          {messages.length > 2 && (
            <button
              onClick={handleRetryLastMessage}
              disabled={isStreaming}
              className="hover:text-indigo-300 flex items-center gap-1 text-[10px] text-slate-400 disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Regenerate</span>
            </button>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2 bg-slate-950 border border-slate-800 focus-within:border-indigo-500 rounded-2xl p-2 transition-colors"
        >
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask a question about this textbook, request an analogy, or type a math formula..."
            disabled={isStreaming}
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none px-1.5 py-1"
          />

          <button
            type="submit"
            disabled={!inputQuestion.trim() || isStreaming}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors shrink-0 shadow-md"
            title="Send Question (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
