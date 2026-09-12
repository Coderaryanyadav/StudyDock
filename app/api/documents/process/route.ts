import { NextRequest, NextResponse } from "next/server";
import { processPdfDocument } from "@/lib/documents/processor";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest, isDemoMode } from "@/lib/supabase/auth";

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

    // 2. Strict Authentication: In production, require an authenticated session
    const auth = await authenticateRequest(req);
    if (!auth?.id) {
      return NextResponse.json(
        { error: "Authentication required to upload and index textbooks." },
        { status: 401 }
      );
    }

    const userId = auth.id;

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

    // MIME type & extension check
    const allowedMimes = ["application/pdf", "text/plain", "application/octet-stream"];
    const fileName = file.name.toLowerCase();
    if (!allowedMimes.includes(file.type) && !fileName.endsWith(".pdf") && !fileName.endsWith(".txt")) {
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

    // 4. Real PDF Parsing, Scanned Detection & Vector Indexing Pipeline
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
      message: processedResult.statusMessage,
      book: processedResult.book,
      status: processedResult.status,
      stats: {
        pages: processedResult.pagesCount,
        chunks: processedResult.chunksCount,
        isScannedPdf: processedResult.isScannedPdf,
      },
    });
  } catch (error: any) {
    console.error("Document processing error:", error?.message || error);
    return NextResponse.json(
      { error: "Document processing failed. Please verify that the PDF is valid, unencrypted, and try again." },
      { status: 500 }
    );
  }
}
