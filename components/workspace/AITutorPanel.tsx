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
  Copy,
  Check,
  ChevronDown,
  MessageSquare,
  Compass,
  Play,
  Layers,
  HelpCircle,
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
  onSeekVideoTimestamp?: (seconds: number) => void;
  externalPrompt?: { text: string; mode?: LearningMode; selectedText?: string } | null;
  onClearExternalPrompt?: () => void;
  onLaunchQuizFromAI?: () => void;
  onLaunchFlashcardsFromAI?: () => void;
}

export const AITutorPanel: React.FC<AITutorPanelProps> = React.memo(({
  book,
  activePageNumber,
  activeVideo,
  onNavigateToTextbookPage,
  onSeekVideoTimestamp,
  externalPrompt,
  onClearExternalPrompt,
  onLaunchQuizFromAI,
  onLaunchFlashcardsFromAI,
}) => {
  const [learningMode, setLearningMode] = useState<LearningMode>("explain");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showConvDropdown, setShowConvDropdown] = useState<boolean>(false);

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

  // 1. Load conversations list & latest conversation history from database
  const loadConversations = async (targetConvId?: string) => {
    if (!book?.id) return;
    try {
      const res = await fetch(`/api/conversations?bookId=${encodeURIComponent(book.id)}`);
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
              content: `Hello! I'm your private **AI Academic Tutor** for *${book.title}*.\n\nAsk me anything about your textbook, or select text in the PDF reader to get deep-dive explanations grounded in your exact page numbers.`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              suggestedFollowUps: [
                "Summarize key concepts on this page",
                "Explain this section with an analogy",
                "Give me a 3-question practice quiz",
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
      const res = await fetch(`/api/conversations/${encodeURIComponent(convId)}?bookId=${encodeURIComponent(book.id)}`);
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
                "Explain the core concept",
                "Break down the math step-by-step",
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
    if (externalPrompt?.text) {
      if (externalPrompt.mode) {
        setLearningMode(externalPrompt.mode);
      }
      handleSendMessage(externalPrompt.text);
      if (onClearExternalPrompt) onClearExternalPrompt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPrompt]);

  const handleCreateNewConversation = async () => {
    if (!book?.id) return;
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          title: "New Academic Chat",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.conversation?.id) {
        const newConv = data.conversation;
        setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== newConv.id)]);
        setActiveConversationId(newConv.id);
        setShowConvDropdown(false);
        setMessages([
          {
            id: `msg-new-${newConv.id}`,
            sender: "ai",
            content: `New chat started for *${book.title}*. What topic would you like to explore?`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            suggestedFollowUps: [
              "Summarize current page",
              "Explain the technical diagram",
              "Test my knowledge",
            ],
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const handleRenameConversation = async (convId: string, currentTitle: string) => {
    const newTitle = prompt("Enter new title for conversation:", currentTitle);
    if (!newTitle || !newTitle.trim() || newTitle.trim() === currentTitle) return;

    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(convId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          bookId: book.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: newTitle.trim() } : c))
        );
      }
    } catch (err) {
      console.error("Rename conversation error:", err);
    }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this conversation?")) return;

    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(convId)}?bookId=${encodeURIComponent(book.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const remaining = conversations.filter((c) => c.id !== convId);
        setConversations(remaining);

        if (activeConversationId === convId) {
          if (remaining.length > 0) {
            loadConversationHistory(remaining[0].id);
          } else {
            handleCreateNewConversation();
          }
        }
      }
    } catch (err) {
      console.error("Delete conversation error:", err);
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputQuestion).trim();
    if (!textToSend || isStreaming || !book?.id) return;

    // Ensure real active conversation ID exists before sending message
    let convIdToSend = activeConversationId;
    if (!convIdToSend) {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: book.id,
            title: textToSend.slice(0, 40),
          }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.conversation?.id) {
          convIdToSend = data.conversation.id;
          setActiveConversationId(convIdToSend);
          setConversations((prev) => [data.conversation, ...prev]);
        }
      } catch (e) {
        console.error("Auto conversation creation failed:", e);
      }
    }

    const userMessage: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuestion("");
    setIsStreaming(true);

    const aiMessageId = `msg-ai-${Date.now()}`;
    const placeholderAiMessage: ChatMessage = {
      id: aiMessageId,
      sender: "ai",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      learningMode,
    };
    setMessages((prev) => [...prev, placeholderAiMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          conversationId: convIdToSend || undefined,
          question: textToSend,
          currentPage: activePageNumber,
          learningMode,
          videoTimestampSeconds: undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let accumulatedCitations: Citation[] = [];
      let followUps: string[] = [];
      let conversationIdAssigned = convIdToSend;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.replace("data: ", "").trim();
              if (dataStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.fullText) {
                  fullContent = parsed.fullText;
                } else if (parsed.text) {
                  fullContent = parsed.text;
                }
                if (Array.isArray(parsed.citations)) {
                  accumulatedCitations = parsed.citations;
                }
                if (Array.isArray(parsed.suggestedFollowUps)) {
                  followUps = parsed.suggestedFollowUps;
                }
                if (parsed.conversationId && !activeConversationId) {
                  conversationIdAssigned = parsed.conversationId;
                  setActiveConversationId(parsed.conversationId);
                }

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? {
                          ...msg,
                          content: fullContent,
                          citations: accumulatedCitations.length > 0 ? accumulatedCitations : msg.citations,
                          suggestedFollowUps: followUps.length > 0 ? followUps : msg.suggestedFollowUps,
                        }
                      : msg
                  )
                );
              } catch (e) {
                // Non-JSON raw text chunk
                fullContent += dataStr;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId ? { ...msg, content: fullContent } : msg
                  )
                );
              }
            }
          }
        }
      }

      if (book?.id) {
        fetch(`/api/conversations?bookId=${encodeURIComponent(book.id)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && Array.isArray(data.conversations)) {
              setConversations(data.conversations);
            }
          })
          .catch(() => {});
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: `⚠️ I encountered an issue connecting to the AI Tutor service. Please ensure your query is valid and try again.\n\n*Error details: ${err.message || "Network timeout"}*`,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const activeConvTitle =
    conversations.find((c) => c.id === activeConversationId)?.title || "Current Academic Chat";

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080c14] text-slate-100 overflow-hidden relative">
      
      {/* ========================================================================= */}
      {/* Top Academic AI Tutor Bar */}
      {/* ========================================================================= */}
      <div className="h-11 bg-[#0c121e] border-b border-slate-800 px-3 md:px-4 flex items-center justify-between shrink-0 select-none z-10 text-xs">
        
        {/* Left: Conversation Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowConvDropdown(!showConvDropdown)}
            aria-label="Select Academic Conversation"
            aria-expanded={showConvDropdown}
            data-testid="ai-conv-dropdown-btn"
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800 text-slate-200 font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span className="truncate max-w-[160px] md:max-w-[220px]">{activeConvTitle}</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {showConvDropdown && (
            <div data-testid="ai-conv-dropdown-menu" className="absolute left-0 mt-1 w-64 bg-[#0f1624] border border-slate-800 rounded-lg shadow-xl p-2 z-50 text-xs animate-in fade-in">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 mb-1.5 px-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Past Conversations</span>
                <button
                  onClick={handleCreateNewConversation}
                  aria-label="Start New Chat"
                  data-testid="ai-menu-new-chat-btn"
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded px-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Chat</span>
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    data-testid={`conv-item-${conv.id}`}
                    className={`w-full p-1.5 rounded transition-colors flex items-center justify-between gap-1 group ${
                      conv.id === activeConversationId
                        ? "bg-indigo-600/20 text-indigo-300 font-medium"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <button
                      onClick={() => {
                        loadConversationHistory(conv.id);
                        setShowConvDropdown(false);
                      }}
                      className="flex items-center gap-2 flex-1 text-left truncate min-w-0 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded"
                    >
                      <MessageSquare className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate flex-1">{conv.title}</span>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenameConversation(conv.id, conv.title);
                        }}
                        aria-label={`Rename chat ${conv.title}`}
                        className="p-0.5 hover:text-white text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                        title="Rename Chat"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        aria-label={`Delete chat ${conv.title}`}
                        className="p-0.5 hover:text-rose-400 text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                        title="Delete Chat"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Learning Mode Selector & New Chat */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#060910] p-0.5 rounded border border-slate-800" role="tablist" aria-label="Learning Mode Tabs">
            {Object.values(LEARNING_MODES).slice(0, 4).map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={learningMode === m.id}
                onClick={() => setLearningMode(m.id as LearningMode)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                  learningMode === m.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title={m.description}
              >
                {m.name}
              </button>
            ))}
          </div>

          <button
            onClick={handleCreateNewConversation}
            aria-label="Start New Academic Conversation"
            data-testid="ai-new-chat-btn"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            title="Start New Conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* Messages Stream Container */}
      {/* ========================================================================= */}
      <div
        ref={chatContainerRef}
        data-testid="ai-messages-container"
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar text-xs md:text-sm"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            data-testid={`ai-message-${msg.sender}`}
            className={`flex gap-3 max-w-3xl mx-auto ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.sender === "ai" && (
              <div className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className={`space-y-2.5 rounded-lg p-3.5 md:p-4 leading-relaxed ${
                msg.sender === "user"
                  ? "bg-indigo-600 text-white max-w-[85%] shadow-sm"
                  : "bg-[#0f1624] border border-slate-800 text-slate-200 w-full shadow-sm"
              }`}
            >
              {/* Message Header (AI side) */}
              {msg.sender === "ai" && (
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 text-[11px] text-slate-400 font-mono">
                  <span>AI Academic Tutor • Grounded in p.{activePageNumber}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      aria-label="Copy AI response"
                      className="hover:text-slate-200 transition-colors p-1 rounded focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Message Content */}
              <div data-testid="ai-message-text" className="prose prose-invert max-w-none text-xs md:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {msg.content ? (
                  renderMathInText(msg.content)
                ) : (
                  <span className="flex items-center gap-2 text-indigo-400">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    <span>Synthesizing grounded answer from textbook & lectures...</span>
                  </span>
                )}
              </div>

              {/* Citations & Source Badges (Segregated Dual-Source) */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="pt-2.5 border-t border-slate-800/80 space-y-1.5" data-testid="ai-citations-list">
                  <div className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                    Grounded Sources & Citations
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.citations.map((cite, cIdx) => (
                      <button
                        key={cIdx}
                        data-testid="ai-citation-badge"
                        onClick={() => {
                          if (cite.sourceType === "youtube" && cite.videoTimestampSeconds !== undefined && onSeekVideoTimestamp) {
                            onSeekVideoTimestamp(cite.videoTimestampSeconds);
                          } else if (cite.pageNumber) {
                            onNavigateToTextbookPage(cite.pageNumber);
                          }
                        }}
                        aria-label={
                          cite.sourceType === "youtube"
                            ? `Jump to lecture timestamp ${cite.videoFormattedTime || ""}`
                            : `Jump to textbook page ${cite.pageNumber}`
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                          cite.sourceType === "youtube"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 active:scale-[0.98]"
                            : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 active:scale-[0.98]"
                        }`}
                      >
                        {cite.sourceType === "youtube" ? (
                          <Play className="w-3 h-3 fill-current" />
                        ) : (
                          <BookOpen className="w-3 h-3" />
                        )}
                        <span>
                          {cite.sourceType === "youtube"
                            ? `[YouTube — ${cite.videoFormattedTime || "Lecture"}]`
                            : `[Textbook — p.${cite.pageNumber}]`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Follow-Up Action Chips */}
              {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && !isStreaming && (
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                  {msg.suggestedFollowUps.map((chip, chipIdx) => (
                    <button
                      key={chipIdx}
                      onClick={() => handleSendMessage(chip)}
                      className="text-[11px] px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors text-left focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {msg.sender === "user" && (
              <div className="w-6 h-6 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* Bottom Prompt Input Area */}
      {/* ========================================================================= */}
      <div className="p-3 md:p-4 bg-[#0c121e] border-t border-slate-800 shrink-0">
        <div className="max-w-3xl mx-auto space-y-2">
          
          <div className="relative flex items-center rounded-lg bg-[#070b12] border border-slate-800 focus-within:border-indigo-500 transition-colors p-2">
            <textarea
              ref={textareaRef}
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              data-testid="ai-prompt-input"
              aria-label="Ask your AI Academic Tutor"
              placeholder={`Ask your tutor about ${book.title} (Page ${activePageNumber})...`}
              rows={2}
              className="w-full bg-transparent text-white text-xs md:text-sm placeholder:text-slate-500 focus:outline-none resize-none pr-10 custom-scrollbar"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={!inputQuestion.trim() || isStreaming}
              data-testid="ai-send-btn"
              aria-label="Send message to AI tutor"
              className="absolute right-3 bottom-3 p-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white transition-all shadow-sm active:scale-95 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              title="Send message (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>
              Mode: <strong className="text-slate-400 capitalize">{learningMode}</strong> • Press <kbd className="font-mono bg-slate-900 px-1 rounded border border-slate-800 text-slate-400">Enter</kbd> to submit
            </span>
            <span>Grounding: Textbook + YouTube</span>
          </div>

        </div>
      </div>

    </div>
  );
});
