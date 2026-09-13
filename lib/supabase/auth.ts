import { createServerSupabaseClient } from "./server";
import { NextRequest } from "next/server";

export interface AuthSessionUser {
  id: string;
  email: string;
  displayName?: string;
}

/**
 * Authenticates an incoming API request via Supabase Auth session.
 * Derives user identity strictly from auth.getUser().
 * Returns null if not authenticated (fail-closed).
 */
export async function authenticateRequest(req?: NextRequest): Promise<AuthSessionUser | null> {
  return getAuthenticatedUser(req);
}

export async function getAuthenticatedUser(req?: NextRequest): Promise<AuthSessionUser | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  try {
    const authHeader = req?.headers?.get("authorization");
    let userResult;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      if (!token || token === "invalid" || token === "expired" || token === "undefined" || token === "null") {
        return null;
      }
      userResult = await supabase.auth.getUser(token);
    } else {
      userResult = await supabase.auth.getUser();
    }

    const { data, error } = userResult;
    const user = data?.user;

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || "",
      displayName: user.user_metadata?.full_name || user.email?.split("@")[0] || "Scholar",
    };
  } catch (err) {
    console.error("Auth verification error:", err);
    return null;
  }
}

/**
 * Verifies that the authenticated user strictly owns the requested book in Supabase.
 * Fails closed if book does not belong to userId or does not exist.
 */
export async function verifyBookOwnership(userId: string, bookId: string): Promise<boolean> {
  if (!bookId || !userId || userId === "guest-user") {
    return false;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return false;

  try {
    const { data, error } = await supabase
      .from("books")
      .select("id, user_id")
      .eq("id", bookId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.user_id === userId;
  } catch {
    return false;
  }
}

/**
 * Verifies that the authenticated user strictly owns the requested conversation.
 */
export async function verifyConversationOwnership(
  userId: string,
  conversationId: string,
  expectedBookId?: string
): Promise<boolean> {
  if (!conversationId || !userId || userId === "guest-user") return false;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return false;

  try {
    let query = supabase
      .from("conversations")
      .select("id, user_id, book_id")
      .eq("id", conversationId)
      .eq("user_id", userId);

    if (expectedBookId) {
      query = query.eq("book_id", expectedBookId);
    }

    const { data, error } = await query.single();
    if (error || !data) return false;

    return data.user_id === userId;
  } catch {
    return false;
  }
}
