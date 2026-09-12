import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership, isDemoMode } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_BOOK } from "@/lib/demo-data";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = params.id;
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ success: true, results: [] });
    }

    if (bookId.startsWith("demo-") || bookId === DEMO_BOOK.id) {
      const results: Array<{ pageNumber: number; title: string; excerpt: string }> = [];
      for (const page of DEMO_BOOK.pages) {
        if (page.content.toLowerCase().includes(query.toLowerCase()) || page.title.toLowerCase().includes(query.toLowerCase())) {
          const idx = page.content.toLowerCase().indexOf(query.toLowerCase());
          const start = Math.max(0, idx - 40);
          const end = Math.min(page.content.length, idx + query.length + 60);
          results.push({
            pageNumber: page.pageNumber,
            title: page.title,
            excerpt: "..." + page.content.slice(start, end).replace(/\n/g, " ") + "...",
          });
        }
      }
      return NextResponse.json({ success: true, results: results.slice(0, 15) });
    }

    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const isOwner = await verifyBookOwnership(userId, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const supabase = createServerSupabaseClient() || createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable." }, { status: 500 });
    }

    // Search across book_pages
    const { data: pages, error } = await supabase
      .from("book_pages")
      .select("page_number, title, content")
      .eq("book_id", bookId)
      .ilike("content", `%${query}%`)
      .order("page_number", { ascending: true })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: "Search failed." }, { status: 500 });
    }

    const results = (pages || []).map((p) => {
      const idx = p.content.toLowerCase().indexOf(query.toLowerCase());
      const start = Math.max(0, idx - 40);
      const end = Math.min(p.content.length, idx + query.length + 60);
      return {
        pageNumber: p.page_number,
        title: p.title || `Page ${p.page_number}`,
        excerpt: "..." + p.content.slice(start, end).replace(/\n/g, " ") + "...",
      };
    });

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Search API error:", error?.message || error);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
