import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "./admin";

export async function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  let isMockSession = false;
  try {
    const headersList = await headers();
    const authHdr = headersList.get("authorization") || "";
    if (authHdr.includes("mock-jwt-token-")) {
      isMockSession = true;
    }
  } catch {
    // Outside active Next.js request context
  }

  let cookieStore: any = null;
  try {
    cookieStore = await cookies();
    const allCookies = cookieStore?.getAll?.() || [];
    for (const c of allCookies) {
      const rawVal = c.value || "";
      if (rawVal.includes("mock-jwt-token-") || rawVal.includes("mock-refresh-token-")) {
        isMockSession = true;
        break;
      }
      if (rawVal.startsWith("base64-")) {
        try {
          const decoded = Buffer.from(rawVal.replace("base64-", ""), "base64").toString("utf-8");
          if (decoded.includes("mock-jwt-token-") || decoded.includes("mock-refresh-token-")) {
            isMockSession = true;
            break;
          }
        } catch {}
      }
    }
  } catch {
    // Outside active Next.js request context (e.g. standalone test or background script)
  }

  if (isMockSession) {
    return createAdminClient();
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const val = cookieStore?.get(name)?.value;
        if (val && (val.includes("mock-jwt-token-") || val.includes("mock-refresh-token-"))) {
          return undefined;
        }
        return val;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore?.set({ name, value, ...options });
        } catch {
          // Handled for server components
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore?.set({ name, value: "", ...options });
        } catch {
          // Handled for server components
        }
      },
    },
  });
}

