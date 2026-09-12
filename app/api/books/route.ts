import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isDemoMode } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_BOOK } from "@/lib/demo-data";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      if (isDemoMode()) {
        return NextResponse.json({
          success: true,
          books: [
            {
              id: DEMO_BOOK.id,
              title: DEMO_BOOK.title,
              author: DEMO_BOOK.author,
              edition: DEMO_BOOK.edition,
              subject: DEMO_BOOK.subject,
              totalPages: DEMO_BOOK.totalPages,
              status: "READY",
              lastPageRead: 72,
              createdAt: new Date().toISOString(),
            },
          ],
        });
      }
      return NextResponse.json(
        { error: "Authentication required to view your library." },
        { status: 401 }
      );
    }

    const supabase = createServerSupabaseClient() || createAdminClient();
    if (!supabase) {
      if (isDemoMode()) {
        return NextResponse.json({
          success: true,
          books: [
            {
              id: DEMO_BOOK.id,
              title: DEMO_BOOK.title,
              author: DEMO_BOOK.author,
              edition: DEMO_BOOK.edition,
              subject: DEMO_BOOK.subject,
              totalPages: DEMO_BOOK.totalPages,
              status: "READY",
              lastPageRead: 72,
              createdAt: new Date().toISOString(),
            },
          ],
        });
      }
      return NextResponse.json(
        { error: "Database service is unconfigured. Please configure Supabase environment variables." },
        { status: 500 }
      );
    }

    const { data: books, error } = await supabase
      .from("books")
      .select("id, title, author, edition, subject, total_pages, status, status_message, last_page_read, youtube_url, video_title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

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
  } catch (error: any) {
    console.error("Books API error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to retrieve books." },
      { status: 500 }
    );
  }
}
