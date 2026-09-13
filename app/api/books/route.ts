import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";

export const GET = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.STANDARD,
  },
  async ({ userId }) => {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database service is unconfigured. Please configure Supabase environment variables." },
        { status: 500 }
      );
    }

    let { data: books, error } = await supabase
      .from("books")
      .select("id, title, author, edition, subject, total_pages, status, status_message, last_page_read, youtube_url, video_title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error && (error.code === "PGRST301" || error.message?.includes("JWT"))) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const adminClient = createAdminClient();
      if (adminClient) {
        const res = await adminClient
          .from("books")
          .select("id, title, author, edition, subject, total_pages, status, status_message, last_page_read, youtube_url, video_title, created_at, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });
        books = res.data;
        error = res.error;
      }
    }

    if (error) {
      console.error("Fetch books error:", error);
      return NextResponse.json(
        { error: "Failed to fetch library books." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      books: (books || []).map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        edition: b.edition,
        subject: b.subject,
        totalPages: b.total_pages,
        status: b.status,
        statusMessage: b.status_message,
        lastPageRead: b.last_page_read || 1,
        youtubeUrl: b.youtube_url,
        videoTitle: b.video_title,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      })),
    });
  }
);
