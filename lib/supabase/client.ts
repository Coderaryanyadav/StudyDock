import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("your-project-id")) {
    // Return null if credentials are not yet configured (allowing graceful demo fallback)
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export const getSupabaseBrowserClient = createClient;
