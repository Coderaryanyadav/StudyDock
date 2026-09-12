/**
 * Robust YouTube video ID extraction, domain validation, and SSRF-safe metadata retrieval.
 * Rejects non-YouTube domains, malicious protocols, and invalid formats.
 * Never fabricates metadata or placeholders.
 */

export function extractYoutubeId(input: string): string | null {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();

  // If already a clean 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Parse URL safely to prevent SSRF and open redirect vulnerabilities
  let parsedUrl: URL;
  try {
    const urlWithProto = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
    parsedUrl = new URL(urlWithProto);
  } catch {
    return null;
  }

  // Require HTTP or HTTPS protocol
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const validDomains = [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
  ];

  const isValidDomain = validDomains.some(
    (domain) => hostname === domain || hostname.endsWith("." + domain)
  );

  if (!isValidDomain) {
    return null;
  }

  // short URL format: youtu.be/<11-char-id>
  if (hostname.includes("youtu.be")) {
    const pathId = parsedUrl.pathname.slice(1).split("/")[0];
    if (/^[a-zA-Z0-9_-]{11}$/.test(pathId)) {
      return pathId;
    }
  }

  // Standard URL parameters: v=<11-char-id>
  const vParam = parsedUrl.searchParams.get("v");
  if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
    return vParam;
  }

  // Path formats: /embed/<id>, /v/<id>, /shorts/<id>, /live/<id>
  const pathMatch = parsedUrl.pathname.match(/\/(?:v|embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
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
 * Fetches real YouTube metadata using official public oEmbed standard.
 * Returns null if the video is unavailable or metadata cannot be retrieved.
 * Fails closed without fabricating titles or placeholders.
 */
export async function fetchYoutubeMetadata(youtubeId: string): Promise<YoutubeMetadata | null> {
  const cleanId = extractYoutubeId(youtubeId);
  if (!cleanId) return null;

  try {
    // Construct safe, pinned oEmbed URL strictly using validated cleanId
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(cleanId)}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: {
        "User-Agent": "StudyDock-Academic-Client/1.0",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      // Try secondary fallback via noembed with strict ID URL
      const noembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${encodeURIComponent(cleanId)}`;
      const noembedRes = await fetch(noembedUrl);
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
