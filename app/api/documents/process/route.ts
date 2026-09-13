import { NextResponse } from "next/server";
import { processPdfDocument } from "@/lib/documents/processor";
import { withApiHandler, RATE_LIMITS } from "@/lib/api/with-handler";
import { z } from "zod";

export const runtime = "nodejs";

const formSchema = z.object({
  title: z.string().max(255).optional(),
  author: z.string().max(255).optional(),
  subject: z.string().max(255).optional(),
});

export const POST = withApiHandler(
  {
    requireAuth: true,
    rateLimit: RATE_LIMITS.UPLOAD,
  },
  async ({ userId, req }) => {
    const formData = await req.formData();
      const file = formData.get("file") as File | null;
      
      const rawTitle = formData.get("title") as string || "";
      const rawAuthor = formData.get("author") as string || "";
      const rawSubject = formData.get("subject") as string || "";

      const parseResult = formSchema.safeParse({ title: rawTitle, author: rawAuthor, subject: rawSubject });
      if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid form data", details: parseResult.error.issues }, { status: 400 });
      }
      
      const { title, author, subject } = parseResult.data;

      if (!file) {
        return NextResponse.json({ error: "No document file provided." }, { status: 400 });
      }

      const fileName = file.name.toLowerCase();
      const isPdfMime = file.type === "application/pdf" || file.type === "application/x-pdf";
      const isPdfExt = fileName.endsWith(".pdf");

      if (!isPdfExt && !isPdfMime) {
        return NextResponse.json(
          { error: "Unsupported file type. Please upload a valid PDF document (.pdf)." },
          { status: 400 }
        );
      }

      const MAX_SIZE = 50 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: "File exceeds 50MB limit. Please upload a smaller document." },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const processedResult = await processPdfDocument({
        fileBuffer: buffer,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type || "application/pdf",
        userId: userId!,
        title: title?.trim() || file.name.replace(/\.[^/.]+$/, ""),
        author: author?.trim() || "Unknown Author",
        subject: subject?.trim() || undefined,
      });

      return NextResponse.json({
        success: true,
        message: processedResult.statusMessage,
        book: processedResult.book,
        status: processedResult.status,
        stats: {
          pages: processedResult.pagesCount,
          chunks: processedResult.chunksCount,
          isScannedPdf: processedResult.isScannedPdf,
        },
      });
    }
  )(req as any);
};
