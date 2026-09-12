import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import {
  attachVideoToBook,
  getVideosForBook,
  detachVideoFromBook,
} from "@/lib/videos/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const bookId = resolvedParams.id;
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
    const { youtubeUrl, title } = body;

    if (!youtubeUrl || typeof youtubeUrl !== "string") {
      return NextResponse.json({ error: "Valid YouTube URL is required." }, { status: 400 });
    }

    const video = await attachVideoToBook(userId, bookId, youtubeUrl, title);
    if (!video) {
      return NextResponse.json({ error: "Invalid YouTube URL or failed to attach video." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      video,
    });
  } catch (error: any) {
    console.error("Connect video error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to connect YouTube lecture." },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const bookId = resolvedParams.id;
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const isOwner = await verifyBookOwnership(userId, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const videos = await getVideosForBook(userId, bookId);
    const video = videos.length > 0 ? videos[0] : null;

    return NextResponse.json({
      success: true,
      video,
    });
  } catch (error: any) {
    console.error("Get video error:", error);
    return NextResponse.json({ error: "Failed to fetch video." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const bookId = resolvedParams.id;
    const auth = await authenticateRequest(req);
    const userId = auth?.id;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const isOwner = await verifyBookOwnership(userId, bookId);
    if (!isOwner) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");

    const videos = await getVideosForBook(userId, bookId);
    const targetId = videoId || (videos.length > 0 ? videos[0].id : null);

    if (targetId) {
      await detachVideoFromBook(userId, targetId, bookId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete video error:", error);
    return NextResponse.json({ error: "Failed to delete video." }, { status: 500 });
  }
}
