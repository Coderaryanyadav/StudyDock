import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const bookId = resolvedParams.id;

    if (!bookId) {
      return NextResponse.json({ error: "Book ID is required." }, { status: 400 });
    }

    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required to view this PDF." },
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

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Storage client unavailable." }, { status: 500 });
    }

    // Get book storage path
    const { data: bookRecord, error: bookErr } = await supabase
      .from("books")
      .select("storage_path, title")
      .eq("id", bookId)
      .eq("user_id", userId)
      .single();

    if (bookErr || !bookRecord || !bookRecord.storage_path) {
      return NextResponse.json({ error: "PDF storage file not found." }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const returnUrlOnly = searchParams.get("url") === "true";

    if (returnUrlOnly) {
      // Create short-lived signed URL (1 hour)
      const { data: signedData, error: signedErr } = await supabase.storage
        .from("textbooks")
        .createSignedUrl(bookRecord.storage_path, 3600);

      if (signedErr || !signedData?.signedUrl) {
        return NextResponse.json({ error: "Failed to generate signed PDF URL." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        signedUrl: signedData.signedUrl,
      });
    }

    // Stream PDF directly with appropriate headers
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("textbooks")
      .download(bookRecord.storage_path);

    if (downloadErr || !fileData) {
      return NextResponse.json({ error: "Failed to download PDF from storage." }, { status: 500 });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const safeTitle = (bookRecord.title || "textbook").replace(/[^a-zA-Z0-9_-]/g, "_");

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeTitle}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("PDF delivery error:", error?.message || error);
    return NextResponse.json({ error: "Failed to stream PDF." }, { status: 500 });
  }
}
