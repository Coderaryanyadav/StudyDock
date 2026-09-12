import { NextRequest, NextResponse } from "next/server";
import { processPdfDocument } from "@/lib/documents/processor";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting: Max 10 document processing requests per IP per minute
    const ip = req.headers.get("x-forwarded-for") || "local-client";
    const limitCheck = checkRateLimit(`doc-proc-${ip}`, { limit: 10, windowMs: 60 * 1000 });
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "Too many document uploads. Please wait before processing another file." },
        { status: 429, headers: { "Retry-After": limitCheck.resetInSec.toString() } }
      );
    }

    // 2. Authenticate if bearer token / session is present, or assign anonymous guest ID
    const auth = await authenticateRequest(req);
    const userId = auth?.id || "guest-user";

    // 3. Extract and Validate Multipart Form Data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "";
    const author = (formData.get("author") as string) || "";
    const subject = (formData.get("subject") as string) || "";

    if (!file) {
      return NextResponse.json(
        { error: "No document file provided." },
        { status: 400 }
      );
    }

    // MIME type check
    const allowedMimes = ["application/pdf", "text/plain", "application/octet-stream"];
    if (!allowedMimes.includes(file.type) && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a valid PDF document." },
        { status: 400 }
      );
    }

    // File size limit: 50MB
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 50MB limit. Please upload a smaller document." },
        { status: 400 }
      );
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Real PDF Parsing & Vector Indexing Pipeline
    const processedResult = await processPdfDocument({
      fileBuffer: buffer,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || "application/pdf",
      userId,
      title: title || file.name.replace(/\.[^/.]+$/, ""),
      author: author || "Academic Author",
      subject: subject || "General Studies",
    });

    return NextResponse.json({
      success: true,
      message: `Successfully extracted and indexed ${processedResult.pagesCount} pages and ${processedResult.chunksCount} semantic chunks.`,
      book: processedResult.book,
      stats: {
        pages: processedResult.pagesCount,
        chunks: processedResult.chunksCount,
      },
    });
  } catch (error: any) {
    console.error("Document processing API error:", error);
    return NextResponse.json(
      { error: "Document processing failed. Please verify that the PDF is not password-protected and try again." },
      { status: 500 }
    );
  }
}
