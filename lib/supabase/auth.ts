import { createServerSupabaseClient } from "./server";
import { createAdminClient } from "./admin";
import { NextRequest } from "next/server";

export interface AuthSessionUser {
  id: string;
  email: string;
  displayName?: string;
  isDemo?: boolean;
}

/**
 * Checks whether the server is explicitly operating in isolated DEMO_MODE.
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/**
 * Authenticates an incoming API request.
 * Returns the authenticated user or null.
 * Strictly returns null for unauthenticated users in production.
 */
export async function authenticateRequest(req?: NextRequest): Promise<AuthSessionUser | null> {
  return getAuthenticatedUser(req);
}

export async function getAuthenticatedUser(req?: NextRequest): Promise<AuthSessionUser | null> {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    if (isDemoMode()) {
      return {
        id: "demo-user-001",
        email: "demo@studydock.ai",
        displayName: "Demo Scholar",
        isDemo: true,
      };
    }
    return null;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      if (isDemoMode()) {
        return {
          id: "demo-user-001",
          email: "demo@studydock.ai",
          displayName: "Demo Scholar",
          isDemo: true,
        };
      }
      return null;
    }

    return {
      id: user.id,
      email: user.email || "",
      displayName: user.user_metadata?.full_name || user.email?.split("@")[0] || "Scholar",
      isDemo: false,
    };
  } catch (err) {
    console.error("Auth verification error:", err);
    return null;
  }
}

/**
 * Verifies that the authenticated user strictly owns the requested book.
 * Returns true if owned (or if in demo mode and accessing demo book), false otherwise.
 */
export async function verifyBookOwnership(userId: string, bookId: string): Promise<boolean> {
  if (!bookId) return false;

  // Demo book access is only allowed for demo book IDs in demo mode
  if (bookId.startsWith("demo-")) {
    return isDemoMode() || bookId === "demo-cn-topdown";
  }

  if (!userId || userId === "guest-user") {
    return false;
  }

  const supabase = await createServerSupabaseClient() || createAdminClient();
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

  const supabase = await createServerSupabaseClient() || createAdminClient();
  if (!supabase) return false;

  try {
    const query = supabase
      .from("conversations")
      .select("id, user_id, book_id")
      .eq("id", conversationId)
      .eq("user_id", userId);

    if (expectedBookId && !expectedBookId.startsWith("demo-")) {
      query.eq("book_id", expectedBookId);
    }

    const { data, error } = await query.single();
    if (error || !data) return false;

    return data.user_id === userId;
  } catch {
    return false;
  }
}
