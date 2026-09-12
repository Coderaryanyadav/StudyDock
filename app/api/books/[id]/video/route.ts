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

    const supabase = (await createServerSupabaseClient()) || createAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: true, video: null });
    }

    const { data: video } = await supabase
      .from("videos")
      .select("*, video_topics(*)")
      .eq("book_id", bookId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!video) {
      return NextResponse.json({ success: true, video: null });
    }

    return NextResponse.json({
      success: true,
      video: {
        id: video.id,
        youtubeId: video.youtube_id,
        title: video.title,
        channelName: video.channel_name,
        durationSeconds: video.duration_seconds || 0,
        formattedDuration: video.formatted_duration || "00:00",
        bookId: video.book_id,
        topics: (video.video_topics || []).map((t: any) => ({
          timestampSeconds: t.timestamp_seconds,
          formattedTime: t.formatted_time,
          title: t.title,
          chapterId: `ch-${t.page_number || 1}`,
          pageNumber: t.page_number || 1,
          summary: t.summary || "",
        })),
      },
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

    const supabase = (await createServerSupabaseClient()) || createAdminClient();
    if (supabase) {
      await supabase.from("videos").delete().eq("book_id", bookId).eq("user_id", userId);
      await supabase
        .from("books")
        .update({ youtube_url: null, video_title: null })
        .eq("id", bookId)
        .eq("user_id", userId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete video error:", error);
    return NextResponse.json({ error: "Failed to delete video." }, { status: 500 });
  }
}
