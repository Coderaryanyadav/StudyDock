import { createServerSupabaseClient } from "./server";
import { NextRequest } from "next/server";

export interface AuthSessionUser {
  id: string;
  email: string;
  displayName?: string;
  isDemo?: boolean;
}

/**
 * Authenticates an incoming API request.
 * Returns the authenticated user or null.
 * When Supabase is not configured or request is in demo mode, returns demo user context.
 */
export async function authenticateRequest(req?: NextRequest): Promise<AuthSessionUser | null> {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    // Demo fallback user when Supabase is not yet configured
    return {
      id: "demo-user-001",
      email: "student@studydock.edu",
      displayName: "Demo Student",
      isDemo: true,
    };
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || "",
      displayName: user.user_metadata?.full_name || user.email?.split("@")[0] || "Student",
      isDemo: false,
    };
  } catch (err) {
    console.error("Auth verification error:", err);
    return null;
  }
}
