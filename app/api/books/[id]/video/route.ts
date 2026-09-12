import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyBookOwnership } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    if (!bookId.startsWith("demo-")) {
      const isOwner = await verifyBookOwnership(userId, bookId);
      if (!isOwner) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }
    }

    const body = await req.json();
    const { youtubeUrl, title, channelName, durationSeconds } = body;

    if (!youtubeUrl || typeof youtubeUrl !== "string") {
      return NextResponse.json({ error: "Valid YouTube URL is required." }, { status: 400 });
    }

    // Extract YouTube video ID
    let youtubeId = "";
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = youtubeUrl.match(regExp);
    if (match && match[2].length === 11) {
      youtubeId = match[2];
    } else {
      return NextResponse.json({ error: "Invalid YouTube URL format." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient() || createAdminClient();
    if (supabase && !bookId.startsWith("demo-")) {
      // Update book with connected lecture
      await supabase
        .from("books")
        .update({
          youtube_url: youtubeUrl,
          video_title: title || `YouTube Lecture (${youtubeId})`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookId)
        .eq("user_id", userId);

      // Insert or upsert in videos table
      await supabase.from("videos").insert({
        user_id: userId,
        book_id: bookId,
        youtube_id: youtubeId,
        title: title || `Lecture (${youtubeId})`,
        channel_name: channelName || null,
        duration_seconds: durationSeconds || 0,
      });
    }

    const durSec = typeof durationSeconds === "number" ? durationSeconds : 0;
    const formattedDuration = durSec > 0 
      ? `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, "0")}`
      : "00:00";

    return NextResponse.json({
      success: true,
      video: {
        id: `vid-${youtubeId}`,
        youtubeId,
        title: title || `YouTube Lecture (${youtubeId})`,
        channelName: channelName || null,
        durationSeconds: durSec,
        formattedDuration,
        bookId,
        topics: [],
      },
    });
  } catch (error: any) {
    console.error("Connect video error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to connect YouTube lecture." },
      { status: 500 }
    );
  }
}
