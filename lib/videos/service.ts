import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyBookOwnership } from "@/lib/supabase/auth";
import { VideoLecture, VideoTranscriptSegment } from "@/types";
import { extractYoutubeId, fetchYoutubeMetadata } from "@/lib/youtube/metadata";
import { fetchYoutubeTranscript } from "@/lib/youtube/transcript";
import { Logger, LogState } from "@/lib/logger";

export async function getVideosForBook(
  userId: string,
  bookId: string
): Promise<VideoLecture[]> {
  if (!userId || !bookId) return [];

  const isOwner = await verifyBookOwnership(userId, bookId);
  if (!isOwner) return [];

  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const { data: rows, error } = await supabase
    .from("videos")
    .select("*, video_topics(*), video_transcripts(*)")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !rows) return [];

  return rows.map((v: any) => {
    const rawTranscripts: any[] = v.video_transcripts || [];
    const transcript: VideoTranscriptSegment[] = rawTranscripts
      .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
      .map((t) => ({
        timestampSeconds: t.timestamp_seconds,
        formattedTime: t.formatted_time,
        text: t.text,
      }));

    return {
      id: v.id,
      youtubeId: v.youtube_id,
      title: v.title || "Metadata unavailable",
      channelName: v.channel_name || null,
      durationSeconds: v.duration_seconds || 0,
      formattedDuration: v.formatted_duration || "00:00",
      bookId: v.book_id,
      topics: (v.video_topics || []).map((t: any) => ({
        timestampSeconds: t.timestamp_seconds,
        formattedTime: t.formatted_time,
        title: t.title,
        chapterId: t.chapter_id || null,
        pageNumber: t.page_number || 1,
        summary: t.summary || "",
      })),
      transcript: transcript.length > 0 ? transcript : undefined,
      transcriptUnavailable: transcript.length === 0,
    };
  });
}

export async function attachVideoToBook(
  userId: string,
  bookId: string,
  urlOrId: string,
  customTitle?: string
): Promise<VideoLecture | null> {
  if (!userId || !bookId || !urlOrId) return null;

  const isOwner = await verifyBookOwnership(userId, bookId);
  if (!isOwner) return null;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const youtubeId = extractYoutubeId(urlOrId);
  if (!youtubeId) return null;

  // 1. Fetch real metadata via oEmbed standard
  const metadata = await fetchYoutubeMetadata(youtubeId);
  if (!metadata) {
    Logger.warn(`Video ${youtubeId} metadata unavailable. Rejecting to prevent fabrication.`, {
      state: LogState.VIDEO_METADATA_UNAVAILABLE,
      youtubeId,
      bookId
    });
    return null;
  }

  // Prevent duplicate attachment
  const { data: existingVideo } = await supabase
    .from("videos")
    .select("id")
    .eq("book_id", bookId)
    .eq("youtube_id", youtubeId)
    .maybeSingle();

  if (existingVideo) {
    Logger.warn(`Video ${youtubeId} already attached to book ${bookId}. Returning existing.`, {
      state: LogState.INFO,
      youtubeId,
      bookId
    });
    const videos = await getVideosForBook(userId, bookId);
    const existing = videos.find((v) => v.youtubeId === youtubeId) || videos[0];
    if (existing) {
      return existing;
    }
  }

  const resolvedTitle = customTitle?.trim() || metadata.title;
  const resolvedChannel = metadata.channelName || null;

  // 2. Insert into videos table
  const { data: videoRow, error } = await supabase
    .from("videos")
    .insert({
      user_id: userId,
      book_id: bookId,
      youtube_id: youtubeId,
      title: resolvedTitle,
      channel_name: resolvedChannel,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !videoRow) {
    Logger.error("Failed to insert video record", {
      state: LogState.DB_FAILED,
      error
    });
    return null;
  }

  // 3. Update book's youtube_url and title
  await supabase
    .from("books")
    .update({
      youtube_url: `https://www.youtube.com/watch?v=${youtubeId}`,
      video_title: resolvedTitle,
    })
    .eq("id", bookId)
    .eq("user_id", userId);

  // 4. Retrieve real transcript if available
  const transcriptSegments = await fetchYoutubeTranscript(youtubeId);
  if (transcriptSegments && transcriptSegments.length > 0) {
    const transcriptRows = transcriptSegments.map((s) => ({
      video_id: videoRow.id,
      timestamp_seconds: s.timestampSeconds,
      formatted_time: s.formattedTime,
      text: s.text,
    }));

    await supabase.from("video_transcripts").insert(transcriptRows);
  }

  return {
    id: videoRow.id,
    youtubeId: videoRow.youtube_id,
    title: videoRow.title,
    channelName: videoRow.channel_name,
    durationSeconds: videoRow.duration_seconds || 0,
    formattedDuration: videoRow.formatted_duration || "00:00",
    bookId: videoRow.book_id,
    topics: [],
    transcript: transcriptSegments && transcriptSegments.length > 0 ? transcriptSegments : undefined,
    transcriptUnavailable: !transcriptSegments || transcriptSegments.length === 0,
  };
}

export async function detachVideoFromBook(
  userId: string,
  videoId: string,
  bookId: string
): Promise<boolean> {
  if (!userId || !videoId || !bookId) return false;

  const isOwner = await verifyBookOwnership(userId, bookId);
  if (!isOwner) return false;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("videos")
    .delete()
    .eq("id", videoId)
    .eq("user_id", userId);

  if (bookId) {
    await supabase
      .from("books")
      .update({ youtube_url: null, video_title: null })
      .eq("id", bookId)
      .eq("user_id", userId);
  }

  return !error;
}
