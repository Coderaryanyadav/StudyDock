import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyBookOwnership, verifyConversationOwnership } from "@/lib/supabase/auth";
import { ChatMessage, Citation, LearningMode } from "@/types";

export interface ConversationSummary {
  id: string;
  bookId: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ConversationRecord {
  id: string;
  bookId: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

/**
 * Sanitizes and truncates conversation title deterministically
 */
export function sanitizeConversationTitle(input: string, maxLength = 50): string {
  if (!input) return "Academic Tutor Session";
  const cleaned = input
    .trim()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\w\s\-\?\.\,\:\!]/gi, "")
    .replace(/\s+/g, " ");
  if (!cleaned) return "Academic Tutor Session";
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength).trim() + "..." : cleaned;
}

/**
 * Lists all active conversations for an authenticated user and textbook
 * Fails closed if book is not owned by user.
 */
export async function getConversationsForUser(
  userId: string,
  bookId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ConversationSummary[]> {
  if (!userId || !bookId) {
    throw new Error("User ID and Book ID are required to list conversations.");
  }

  const isOwner = await verifyBookOwnership(userId, bookId);
  if (!isOwner) {
    throw new Error("Access denied. You do not own this textbook.");
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Database service unavailable.");
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id, book_id, title, created_at, updated_at")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Fetch conversations error:", error.message);
    throw new Error(`Database error fetching conversations: ${error.message}`);
  }

  return (data || []).map((c) => ({
    id: c.id,
    bookId: c.book_id,
    title: c.title || "Study Session",
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
}

/**
 * Retrieves a full conversation record with real persisted messages and citations
 * Verifies conversation ownership and book-scoping strictly.
 */
export async function getConversationWithMessages(
  userId: string,
  conversationId: string,
  expectedBookId?: string
): Promise<ConversationRecord | null> {
  if (!userId || !conversationId) return null;

  const isConvOwner = await verifyConversationOwnership(userId, conversationId, expectedBookId);
  if (!isConvOwner) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("id, book_id, title, created_at, updated_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (convErr || !conv) return null;

  const { data: msgs, error: msgErr } = await supabase
    .from("messages")
    .select("*, message_citations(*)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgErr) {
    console.error("Fetch messages error:", msgErr.message);
    throw new Error(`Database error fetching messages: ${msgErr.message}`);
  }

  return {
    id: conv.id,
    bookId: conv.book_id,
    title: conv.title,
    createdAt: conv.created_at,
    messages: (msgs || []).map((m: any) => ({
      id: m.id,
      sender: m.sender === "user" ? "user" : m.sender === "system" ? "system" : "ai",
      content: m.content,
      timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      learningMode: (m.learning_mode as LearningMode) || "explain",
      citations: (m.message_citations || []).map((c: any) => ({
        id: c.id,
        sourceType: (c.source_type as "textbook" | "youtube") || (c.video_timestamp_seconds !== null ? "youtube" : "textbook"),
        bookId: conv.book_id,
        bookTitle: c.book_title || "Textbook",
        chapter: c.chapter_title || "Chapter",
        section: c.section_title || "Section",
        pageNumber: c.page_number,
        videoTimestampSeconds: c.video_timestamp_seconds ?? undefined,
        videoFormattedTime: c.video_formatted_time ?? undefined,
        excerpt: c.excerpt,
      })),
    })),
  };
}

/**
 * Creates a new private conversation thread for a book
 * Verifies book ownership before inserting into PostgreSQL.
 */
export async function createConversation(
  userId: string,
  bookId: string,
  title?: string
): Promise<ConversationSummary> {
  if (!userId || !bookId) {
    throw new Error("User ID and Book ID are required to create a conversation.");
  }

  const isOwner = await verifyBookOwnership(userId, bookId);
  if (!isOwner) {
    throw new Error("Access denied. You do not own this textbook.");
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Database service unavailable.");
  }

  const initialTitle = sanitizeConversationTitle(title || "New Academic Chat");

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      book_id: bookId,
      title: initialTitle,
    })
    .select("id, book_id, title, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("Create conversation error:", error?.message);
    throw new Error(`Failed to create conversation in database: ${error?.message || "Insert failed"}`);
  }

  return {
    id: data.id,
    bookId: data.book_id,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Renames an existing conversation title with ownership verification
 */
export async function renameConversation(
  userId: string,
  conversationId: string,
  title: string,
  expectedBookId?: string
): Promise<boolean> {
  if (!userId || !conversationId || !title?.trim()) {
    throw new Error("User ID, Conversation ID, and a non-empty Title are required.");
  }

  const sanitized = sanitizeConversationTitle(title, 80);
  const isConvOwner = await verifyConversationOwnership(userId, conversationId, expectedBookId);
  if (!isConvOwner) {
    return false;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("conversations")
    .update({
      title: sanitized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) {
    console.error("Rename conversation DB error:", error.message);
    throw new Error(`Database error renaming conversation: ${error.message}`);
  }

  return true;
}

/**
 * Deletes a conversation and cascades all messages & citations safely
 */
export async function deleteConversation(
  userId: string,
  conversationId: string,
  expectedBookId?: string
): Promise<boolean> {
  if (!userId || !conversationId) return false;

  const isConvOwner = await verifyConversationOwnership(userId, conversationId, expectedBookId);
  if (!isConvOwner) {
    return false;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) {
    console.error("Delete conversation DB error:", error.message);
    throw new Error(`Database error deleting conversation: ${error.message}`);
  }

  return true;
}

/**
 * Saves a user or AI message and associated citations to database.
 * Automatically updates conversation title on first user question if title is default.
 */
export async function saveMessage(
  userId: string,
  conversationId: string,
  sender: "user" | "ai" | "system",
  content: string,
  learningMode?: string,
  citations?: Citation[]
): Promise<string> {
  if (!userId || !conversationId || !content?.trim()) {
    throw new Error("User ID, Conversation ID, and message content are required.");
  }

  const isConvOwner = await verifyConversationOwnership(userId, conversationId);
  if (!isConvOwner) {
    throw new Error("Access denied. You do not own this conversation.");
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Database service unavailable.");
  }

  const { data: msg, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender,
      content: content.trim(),
      learning_mode: learningMode || "explain",
    })
    .select("id")
    .single();

  if (error || !msg) {
    console.error("Save message DB error:", error?.message);
    throw new Error(`Failed to save message to database: ${error?.message || "Insert failed"}`);
  }

  // Insert message citations matching database schema
  if (citations && citations.length > 0) {
    const citationRecords = citations.map((c) => ({
      message_id: msg.id,
      chunk_id: c.id && c.id.startsWith("cite-tb-") ? c.id.replace("cite-tb-", "") : null,
      source_type: c.sourceType || "textbook",
      book_title: c.bookTitle || "Textbook",
      chapter_title: c.chapter || null,
      section_title: c.section || null,
      page_number: c.pageNumber || 1,
      video_timestamp_seconds: c.videoTimestampSeconds ?? null,
      video_formatted_time: c.videoFormattedTime ?? null,
      excerpt: c.excerpt || "",
    }));

    const { error: citeErr } = await supabase.from("message_citations").insert(citationRecords);
    if (citeErr) {
      console.error("Save citations DB error:", citeErr.message);
    }
  }

  // Update conversation updated_at and auto-generate title if currently default
  const { data: conv } = await supabase
    .from("conversations")
    .select("title")
    .eq("id", conversationId)
    .single();

  const currentTitle = conv?.title || "";
  const isDefaultTitle =
    !currentTitle ||
    currentTitle === "New Academic Chat" ||
    currentTitle === "Academic Tutor Session" ||
    currentTitle === "Study Session";

  const updatePayload: { updated_at: string; title?: string } = {
    updated_at: new Date().toISOString(),
  };

  if (sender === "user" && isDefaultTitle) {
    updatePayload.title = sanitizeConversationTitle(content, 45);
  }

  await supabase
    .from("conversations")
    .update(updatePayload)
    .eq("id", conversationId);

  return msg.id;
}

