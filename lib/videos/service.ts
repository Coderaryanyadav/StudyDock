import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VideoLecture } from "@/types";

export async function getVideosForBook(
  userId: string,
  bookId: string
): Promise<VideoLecture[]> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !bookId) return [];

  const { data: rows, error } = await supabase
    .from("videos")
    .select("*, video_topics(*)")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !rows) return [];

  return rows.map((v: any) => ({
    id: v.id,
    youtubeId: v.youtube_id,
    title: v.title,
    channelName: v.channel_name || null,
    durationSeconds: v.duration_seconds || 0,
    formattedDuration: v.formatted_duration || "00:00",
    bookId: v.book_id,
    topics: (v.video_topics || []).map((t: any) => ({
      timestampSeconds: t.timestamp_seconds,
      formattedTime: t.formatted_time,
      title: t.title,
      chapterId: `ch-${t.page_number || 1}`,
      pageNumber: t.page_number || 1,
      summary: t.summary || "",
    })),
  }));
}

export async function attachVideoToBook(
  userId: string,
  bookId: string,
  youtubeId: string,
  title: string,
  channelName?: string
): Promise<VideoLecture | null> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !bookId || !youtubeId) return null;

  const { data, error } = await supabase
    .from("videos")
    .insert({
      user_id: userId,
      book_id: bookId,
      youtube_id: youtubeId,
      title: title || "Attached Lecture",
      channel_name: channelName || null,
    })
    .select("*")
    .single();

  if (error || !data) return null;

  // Also update books.youtube_url
  await supabase
    .from("books")
    .update({
      youtube_url: `https://www.youtube.com/watch?v=${youtubeId}`,
      video_title: title,
    })
    .eq("id", bookId)
    .eq("user_id", userId);

  return {
    id: data.id,
    youtubeId: data.youtube_id,
    title: data.title,
    channelName: data.channel_name,
    durationSeconds: data.duration_seconds || 0,
    formattedDuration: data.formatted_duration || "00:00",
    bookId: data.book_id,
    topics: [],
  };
}

export async function detachVideoFromBook(
  userId: string,
  videoId: string,
  bookId: string
): Promise<boolean> {
  const supabase = (await createServerSupabaseClient()) || createAdminClient();
  if (!supabase || !userId || !videoId) return false;

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
