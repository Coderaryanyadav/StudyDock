import { createAdminClient } from "@/lib/supabase/admin";
import { VideoLecture } from "@/types";

export async function getVideosForBook(
  userId: string,
  bookId: string
): Promise<VideoLecture[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];

  // Verify book ownership
  const { data: book } = await supabase
    .from("books")
    .select("id")
    .eq("id", bookId)
    .eq("user_id", userId)
    .single();

  if (!book) return [];

  const { data: rows, error } = await supabase
    .from("video_lectures")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });

  if (error || !rows) return [];

  return rows.map((v) => ({
    id: v.id,
    youtubeId: v.youtube_id,
    title: v.title,
    channelName: v.channel_name || "Lecture Video",
    durationSeconds: v.duration_seconds || 0,
    formattedDuration: v.duration_seconds
      ? `${Math.floor(v.duration_seconds / 60)}:${String(v.duration_seconds % 60).padStart(2, "0")}`
      : "00:00",
    topics: v.topics || [],
    notes: v.notes || [],
  }));
}
