import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
 * Lists all active conversations for a specific user and textbook
 */
export async function getConversationsForUser(
  userId: string,
  bookId?: string
): Promise<ConversationSummary[]> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId) return [];

  let query = supabase
    .from("conversations")
    .select("id, book_id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (bookId) {
    query = query.eq("book_id", bookId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((c) => ({
    id: c.id,
    bookId: c.book_id,
    title: c.title || "Study Session",
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
}

/**
 * Retrieves a full conversation history with grounded citations
 */
export async function getConversationWithMessages(
  userId: string,
  conversationId: string
): Promise<ConversationRecord | null> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !conversationId) return null;

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (convErr || !conv) return null;

  const { data: msgs, error: msgErr } = await supabase
    .from("messages")
    .select("*, message_citations(*)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgErr || !msgs) {
    return {
      id: conv.id,
      bookId: conv.book_id,
      title: conv.title,
      createdAt: conv.created_at,
      messages: [],
    };
  }

  return {
    id: conv.id,
    bookId: conv.book_id,
    title: conv.title,
    createdAt: conv.created_at,
    messages: msgs.map((m: any) => ({
      id: m.id,
      sender: m.sender === "user" ? "user" : "ai",
      content: m.content,
      timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      learningMode: m.learning_mode as LearningMode | undefined,
      citations: (m.message_citations || []).map((c: any) => ({
        id: c.id,
        bookId: conv.book_id,
        bookTitle: c.book_title,
        chapter: c.chapter_title || "Chapter",
        section: c.section_title || "Section",
        pageNumber: c.page_number,
        excerpt: c.excerpt,
      })),
    })),
  };
}

/**
 * Creates a new private conversation thread for a book
 */
export async function createConversation(
  userId: string,
  bookId: string,
  title?: string
): Promise<ConversationSummary | null> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !bookId) return null;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      book_id: bookId,
      title: title || "New Academic Chat",
    })
    .select("id, book_id, title, created_at, updated_at")
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    bookId: data.book_id,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Renames an existing conversation title
 */
export async function renameConversation(
  userId: string,
  conversationId: string,
  title: string
): Promise<boolean> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !conversationId || !title.trim()) return false;

  const { error } = await supabase
    .from("conversations")
    .update({
      title: title.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("user_id", userId);

  return !error;
}

/**
 * Deletes a conversation and cascades all messages & citations
 */
export async function deleteConversation(
  userId: string,
  conversationId: string
): Promise<boolean> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !conversationId) return false;

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);

  return !error;
}

/**
 * Saves a message and associated citations to database
 */
export async function saveMessage(
  userId: string,
  conversationId: string,
  sender: "user" | "ai" | "system",
  content: string,
  learningMode?: string,
  citations?: Citation[]
): Promise<string | null> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !conversationId || !content) return null;

  const { data: msg, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender,
      content,
      learning_mode: learningMode || null,
    })
    .select("id")
    .single();

  if (error || !msg) return null;

  // Insert message citations matching database schema
  if (citations && citations.length > 0) {
    const citationRecords = citations.map((c) => ({
      message_id: msg.id,
      chunk_id: c.id && c.id.startsWith("cite-chunk-") ? c.id.replace("cite-chunk-", "") : null,
      book_title: c.bookTitle || "Textbook",
      chapter_title: c.chapter || null,
      section_title: c.section || null,
      page_number: c.pageNumber || 1,
      excerpt: c.excerpt || "",
    }));

    await supabase.from("message_citations").insert(citationRecords);
  }

  // Update conversation updated_at
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return msg.id;
}
