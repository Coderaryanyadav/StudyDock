import { VideoTranscriptSegment } from "@/types";
import { extractYoutubeId } from "./metadata";

/**
 * Legitimate YouTube Caption & Transcript Retriever
 * Retrieves real captions from YouTube's public timedtext endpoints if available.
 * If captions are disabled or unavailable, returns null (truthful state).
 */
export async function fetchYoutubeTranscript(
  urlOrId: string
): Promise<VideoTranscriptSegment[] | null> {
  const youtubeId = extractYoutubeId(urlOrId);
  if (!youtubeId) return null;

  try {
    // 1. Fetch YouTube video watch page to discover caption track URL
    const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    const response = await fetch(watchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Look for captionTracks JSON in player response
    const playerResponseMatch = html.match(/"captionTracks":\s*(\[[^\]]+\])/);
    if (!playerResponseMatch) {
      // Captions are not available on this video
      return null;
    }

    const captionTracks = JSON.parse(playerResponseMatch[1]);
    if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
      return null;
    }

    // Prefer English track or default to first available track
    const englishTrack =
      captionTracks.find(
        (t: any) =>
          t.languageCode === "en" ||
          (t.name?.simpleText && t.name.simpleText.toLowerCase().includes("english"))
      ) || captionTracks[0];

    if (!englishTrack || !englishTrack.baseUrl) {
      return null;
    }

    // Fetch the caption track XML/JSON
    const transcriptUrl = englishTrack.baseUrl;
    const transcriptRes = await fetch(transcriptUrl);
    if (!transcriptRes.ok) return null;

    const transcriptXml = await transcriptRes.text();

    // Parse <text start="X" dur="Y">Text</text> elements
    const textRegex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?>([^<]+)<\/text>/g;
    const segments: VideoTranscriptSegment[] = [];

    let match;
    while ((match = textRegex.exec(transcriptXml)) !== null) {
      const startSec = Math.floor(parseFloat(match[1]));
      const rawText = match[3]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\n/g, " ")
        .trim();

      if (rawText.length > 0) {
        const mins = Math.floor(startSec / 60);
        const secs = Math.floor(startSec % 60);
        const formattedTime = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

        // Group consecutive micro-segments within 15 seconds into cohesive passages
        const lastSeg = segments[segments.length - 1];
        if (lastSeg && startSec - lastSeg.timestampSeconds < 12 && lastSeg.text.length < 240) {
          lastSeg.text += " " + rawText;
        } else {
          segments.push({
            timestampSeconds: startSec,
            formattedTime,
            text: rawText,
          });
        }
      }
    }

    return segments.length > 0 ? segments : null;
  } catch (error) {
    console.warn(`Transcript retrieval notice for ${youtubeId}:`, error);
    return null;
  }
}
