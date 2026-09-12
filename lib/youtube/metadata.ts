/**
 * Robust YouTube video ID extraction and authentic metadata retrieval
 * No fabricated metadata or hardcoded placeholders.
 */

export function extractYoutubeId(input: string): string | null {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();

  // If already a clean 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle standard URL variations: watch?v=, youtu.be/, embed/, shorts/, live/
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = trimmed.match(regex);
  if (match && match[1] && match[1].length === 11) {
    return match[1];
  }

  return null;
}

export interface YoutubeMetadata {
  title: string;
  channelName: string | null;
  thumbnailUrl?: string;
  authorUrl?: string;
}

/**
 * Fetches real YouTube metadata using the official public oEmbed standard.
 * Returns null if the video is unavailable or metadata cannot be retrieved.
 */
export async function fetchYoutubeMetadata(youtubeId: string): Promise<YoutubeMetadata | null> {
  const cleanId = extractYoutubeId(youtubeId);
  if (!cleanId) return null;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${cleanId}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: {
        "User-Agent": "StudyDock-Academic-Client/1.0",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      // Try secondary fallback via noembed
      const noembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${cleanId}`);
      if (noembedRes.ok) {
        const noembedData = await noembedRes.json();
        if (noembedData && noembedData.title && !noembedData.error) {
          return {
            title: noembedData.title,
            channelName: noembedData.author_name || null,
            thumbnailUrl: noembedData.thumbnail_url,
            authorUrl: noembedData.author_url,
          };
        }
      }
      return null;
    }

    const data = await res.json();
    if (data && data.title) {
      return {
        title: data.title,
        channelName: data.author_name || null,
        thumbnailUrl: data.thumbnail_url,
        authorUrl: data.author_url,
      };
    }

    return null;
  } catch (error) {
    console.warn("YouTube metadata retrieval notice:", error);
    return null;
  }
}
