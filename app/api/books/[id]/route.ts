import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership, isDemoMode } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_BOOK } from "@/lib/demo-data";
import { Book, BookPage, Chapter } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = params.id;

    if (!bookId) {
      return NextResponse.json({ error: "Book ID is required." }, { status: 400 });
    }

    if (bookId.startsWith("demo-") || bookId === DEMO_BOOK.id) {
      return NextResponse.json({
        success: true,
        book: DEMO_BOOK,
      });
    }

    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required to open this book." },
        { status: 401 }
      );
    }

    const isOwner = await verifyBookOwnership(userId, bookId);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Access denied. You do not own this book." },
        { status: 403 }
      );
    }

    const supabase = createServerSupabaseClient() || createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable." }, { status: 500 });
    }

    // Fetch book record
    const { data: bookRecord, error: bookErr } = await supabase
      .from("books")
      .select("*")
      .eq("id", bookId)
      .eq("user_id", userId)
      .single();

    if (bookErr || !bookRecord) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    // Fetch pages
    const { data: pagesData } = await supabase
      .from("book_pages")
      .select("*")
      .eq("book_id", bookId)
      .order("page_number", { ascending: true });

    // Fetch chapters
    const { data: chaptersData } = await supabase
      .from("chapters")
      .select("*, sections(*)")
      .eq("book_id", bookId)
      .order("number", { ascending: true });

    const pages: BookPage[] = (pagesData || []).map((p) => ({
      pageNumber: p.page_number,
      chapterId: p.chapter_id || "ch-1",
      chapterTitle: p.title || "Chapter",
      sectionId: p.section_id || "sec-1",
      sectionTitle: p.title || "Section",
      title: p.title,
      content: p.content,
      keyTakeaways: p.key_takeaways || [],
      equations: p.equations || [],
    }));

    const chapters: Chapter[] = (chaptersData || []).map((ch) => ({
      id: ch.id,
      number: ch.number,
      title: ch.title,
      startPage: ch.start_page,
      endPage: ch.end_page,
      sections: (ch.sections || []).map((sec: any) => ({
        id: sec.id,
        number: sec.number,
        title: sec.title,
        page: sec.page_number,
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
  } catch (error: any) {
    console.error("Get book error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to retrieve book." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = params.id;
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const isOwner = await verifyBookOwnership(userId, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const body = await req.json();
    const { lastPageRead, title } = body;

    const supabase = createServerSupabaseClient() || createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable." }, { status: 500 });
    }

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof lastPageRead === "number" && lastPageRead >= 1) {
      updatePayload.last_page_read = lastPageRead;
    }
    if (title && typeof title === "string") {
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
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update book." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookId = params.id;
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

    // 1. Get book storage path
    const { data: bookRecord } = await supabase
      .from("books")
      .select("storage_path")
      .eq("id", bookId)
      .eq("user_id", userId)
      .single();

    // 2. Delete storage file if present
    if (bookRecord?.storage_path) {
      await supabase.storage.from("textbooks").remove([bookRecord.storage_path]);
    }

    // 3. Delete book record (cascades to pages, chunks, highlights, conversations)
    const { error } = await supabase
      .from("books")
      .delete()
      .eq("id", bookId)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: "Failed to delete book." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Book deleted successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to delete book." }, { status: 500 });
  }
}
