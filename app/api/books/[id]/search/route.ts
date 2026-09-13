import { NextResponse } from "next/server";
import { verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

const bookParamsSchema = z.object({
  id: z.string().string().min(1, "Invalid book ID format"),
});

const searchQuerySchema = z.object({
  q: z.string().max(100, "Search query is too long").optional(),
});

export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;

  return withApiHandler(
    {
      requireAuth: true,
      rateLimit: RATE_LIMITS.STANDARD,
      querySchema: searchQuerySchema,
    },
    async ({ userId, query }) => {
      const parseResult = bookParamsSchema.safeParse(resolvedParams);
      if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid book ID", details: parseResult.error.errors }, { status: 400 });
      }
      const bookId = parseResult.data.id;

      const q = query?.q || "";

      if (!q || q.trim().length === 0) {
        return NextResponse.json({ success: true, results: [] });
      }

      const isOwner = await verifyBookOwnership(userId!, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }

      const supabase = await createServerSupabaseClient();
      if (!supabase) {
        return NextResponse.json({ error: "Database client unavailable." }, { status: 500 });
      }

      const { data: pages, error } = await supabase
        .from("book_pages")
        .select("page_number, title, content")
        .eq("book_id", bookId)
        .ilike("content", `%${q}%`)
        .order("page_number", { ascending: true })
        .limit(20);

      if (error) {
        return NextResponse.json({ error: "Search failed." }, { status: 500 });
      }

      const results = (pages || []).map((p) => {
        const idx = p.content.toLowerCase().indexOf(q.toLowerCase());
        const start = Math.max(0, idx - 40);
        const end = Math.min(p.content.length, idx + q.length + 60);
        return {
          pageNumber: p.page_number,
          title: p.title || `Page ${p.page_number}`,
          excerpt: "..." + p.content.slice(start, end).replace(/\n/g, " ") + "...",
        };
      });

      return NextResponse.json({ success: true, results });
    }
  )(req as any);
};
