import { NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

export const runtime = "nodejs";

const bookParamsSchema = z.object({
  id: z.string().min(1, "Invalid book ID format"),
});

const pdfQuerySchema = z.object({
  url: z.enum(["true", "false"]).optional(),
});

export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;

  return withApiHandler(
    {
      requireAuth: true,
      rateLimit: RATE_LIMITS.STANDARD,
      querySchema: pdfQuerySchema,
    },
    async ({ req, userId, query }) => {
      const auth = await authenticateRequest(req);
      if (!userId || !auth?.id) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }

      const parseResult = bookParamsSchema.safeParse(resolvedParams);
      if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid book ID", details: parseResult.error.issues }, { status: 400 });
      }
      const bookId = parseResult.data.id;

      const isOwner = await verifyBookOwnership(userId, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied. You do not own this book." }, { status: 403 });
      }

      const supabase = createAdminClient();
      if (!supabase) {
        return NextResponse.json({ error: "Storage client unavailable." }, { status: 500 });
      }

      const { data: bookRecord, error: bookErr } = await supabase
        .from("books")
        .select("storage_path, title")
        .eq("id", bookId)
        .eq("user_id", userId)
        .single();

      if (bookErr || !bookRecord || !bookRecord.storage_path) {
        return NextResponse.json({ error: "PDF storage file not found." }, { status: 404 });
      }

      const returnUrlOnly = query?.url === "true";

      if (returnUrlOnly) {
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
    }
  )(req as any);
};
