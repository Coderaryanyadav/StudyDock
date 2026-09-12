import { createAdminClient } from "@/lib/supabase/admin";
import { ChatMessage, Citation, LearningMode } from "@/types";

export interface ConversationRecord {
  id: string;
  bookId: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export async function getConversationsForUser(
  userId: string,
  bookId?: string
): Promise<{ id: string; title: string; createdAt: string }[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];

  let query = supabase
    .from("conversations")
    .select("id, title, created_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (bookId) {
    query = query.eq("book_id", bookId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((c) => ({
    id: c.id,
    title: c.title || "Study Session",
    createdAt: c.created_at,
  }));
}

export async function getConversationWithMessages(
  userId: string,
  conversationId: string
): Promise<ConversationRecord | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (convErr || !conv) return null;

  const { data: msgs, error: msgErr } = await supabase
    .from("messages")
    .select("*")
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
    messages: msgs.map((m) => ({
      id: m.id,
      sender: m.role === "user" ? "user" : "ai",
      content: m.content,
      timestamp: m.created_at,
      learningMode: m.learning_mode as LearningMode | undefined,
      citations: m.citations as Citation[] | undefined,
    })),
  };
}
