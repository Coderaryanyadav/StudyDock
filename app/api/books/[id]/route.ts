import { NextResponse } from "next/server";
import { verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Book, BookPage, Chapter } from "@/types";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

const bookParamsSchema = z.object({
  id: z.string().string().min(1, "Invalid book ID format"),
});

const patchBookSchema = z.object({
  lastPageRead: z.number().int().min(1).optional(),
  title: z.string().min(1).max(255).optional(),
}).strict();

export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  
  return withApiHandler(
    {
      requireAuth: true,
      rateLimit: RATE_LIMITS.STANDARD,
    },
    async ({ userId }) => {
      // Manual UUID parsing for route params since withApiHandler doesn't handle Next params directly
      const parseResult = bookParamsSchema.safeParse(resolvedParams);
      if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid book ID", details: parseResult.error.errors }, { status: 400 });
      }
      const bookId = parseResult.data.id;

      const isOwner = await verifyBookOwnership(userId!, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied. You do not own this book." }, { status: 403 });
      }

      const supabase = await createServerSupabaseClient();
      if (!supabase) {
        return NextResponse.json({ error: "Database client unavailable." }, { status: 500 });
      }

      const { data: bookRecord, error: bookErr } = await supabase
        .from("books")
        .select("*")
        .eq("id", bookId)
        .eq("user_id", userId)
        .single();

      if (bookErr || !bookRecord) {
        return NextResponse.json({ error: "Book not found." }, { status: 404 });
      }

      const { data: pagesData } = await supabase
        .from("book_pages")
        .select("*, chapters:chapter_id(id, title), sections:section_id(id, title)")
        .eq("book_id", bookId)
        .order("page_number", { ascending: true });

      const { data: chaptersData } = await supabase
        .from("chapters")
        .select("*, sections(*)")
        .eq("book_id", bookId)
        .order("number", { ascending: true });

      const pages: BookPage[] = (pagesData || []).map((p: any) => {
        const chTitle = p.chapters?.title || null;
        const secTitle = p.sections?.title || null;
        return {
          id: p.id,
          bookId: p.book_id,
          pageNumber: p.page_number,
          chapterId: p.chapter_id || null,
          chapterTitle: chTitle,
          sectionId: p.section_id || null,
          sectionTitle: secTitle,
          title: p.title || secTitle || (chTitle ? `${chTitle} (p.${p.page_number})` : `Page ${p.page_number}`),
          content: p.content,
          keyTakeaways: p.key_takeaways || [],
          equations: p.equations || [],
        };
      });

      const chapters: Chapter[] = (chaptersData || []).map((ch: any) => ({
        id: ch.id,
        bookId: ch.book_id,
        number: ch.number,
        title: ch.title,
        startPage: ch.start_page,
        endPage: ch.end_page,
        sections: (ch.sections || []).map((sec: any) => ({
          id: sec.id,
          chapterId: sec.chapter_id,
          number: sec.number,
          title: sec.title,
          page: sec.page_number,
          pageNumber: sec.page_number,
        })),
      }));

      const fullBook: Book = {
        id: bookRecord.id,
        title: bookRecord.title,
        author: bookRecord.author,
        edition: bookRecord.edition,
        subject: bookRecord.subject,
        totalPages: bookRecord.total_pages || pages.length,
        coverImage: bookRecord.cover_image,
        chapters,
        pages,
        chunks: [],
      };

      return NextResponse.json({
        success: true,
        book: fullBook,
        lastPageRead: bookRecord.last_page_read || 1,
        youtubeUrl: bookRecord.youtube_url,
        videoTitle: bookRecord.video_title,
      });
    }
  )(req as any);
};

export const PATCH = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;

  return withApiHandler(
    {
      requireAuth: true,
      rateLimit: RATE_LIMITS.STANDARD,
      bodySchema: patchBookSchema,
    },
    async ({ userId, body }) => {
      const parseResult = bookParamsSchema.safeParse(resolvedParams);
      if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid book ID", details: parseResult.error.errors }, { status: 400 });
      }
      const bookId = parseResult.data.id;

      const isOwner = await verifyBookOwnership(userId!, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }

      const supabase = await createServerSupabaseClient();
      if (!supabase) {
        return NextResponse.json({ error: "Database client unavailable." }, { status: 500 });
      }

      const { lastPageRead, title } = body as z.infer<typeof patchBookSchema>;
      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      
      if (lastPageRead !== undefined) {
        updatePayload.last_page_read = lastPageRead;
      }
      if (title !== undefined) {
        updatePayload.title = title.trim();
      }

      const { error } = await supabase
        .from("books")
        .update(updatePayload)
        .eq("id", bookId)
        .eq("user_id", userId);

      if (error) {
        return NextResponse.json({ error: "Failed to update book." }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }
  )(req as any);
};

export const DELETE = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;

  return withApiHandler(
    {
      requireAuth: true,
      rateLimit: RATE_LIMITS.STANDARD,
    },
    async ({ userId }) => {
      const parseResult = bookParamsSchema.safeParse(resolvedParams);
      if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid book ID", details: parseResult.error.errors }, { status: 400 });
      }
      const bookId = parseResult.data.id;

      const isOwner = await verifyBookOwnership(userId!, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }

      const supabase = await createServerSupabaseClient();
      if (!supabase) {
        return NextResponse.json({ error: "Database client unavailable." }, { status: 500 });
      }

      const { data: bookRecord } = await supabase
        .from("books")
        .select("storage_path")
        .eq("id", bookId)
        .eq("user_id", userId)
        .single();

      if (bookRecord?.storage_path) {
        await supabase.storage.from("textbooks").remove([bookRecord.storage_path]);
      }

      const { error } = await supabase
        .from("books")
        .delete()
        .eq("id", bookId)
        .eq("user_id", userId);

      if (error) {
        return NextResponse.json({ error: "Failed to delete book." }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Book deleted successfully." });
    }
  )(req as any);
};
