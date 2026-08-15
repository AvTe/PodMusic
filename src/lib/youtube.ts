const YOUTUBE_ID_RE = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;

/** Extracts an 11-character video id from any common YouTube URL shape. */
export function getYoutubeId(url: string): string | null {
  const match = url.match(YOUTUBE_ID_RE);
  return match && match[2].length === 11 ? match[2] : null;
}

/** `mqdefault` is more universally available than `hqdefault`, which 404s on some videos. */
export function getYoutubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}
