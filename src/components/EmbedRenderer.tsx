"use client";

import React from 'react';
import SmartEmbed from './SmartEmbed';
import FarcasterCastEmbed from './FarcasterCastEmbed';

// Extract YouTube video ID from various URL formats
function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1].split('?')[0];
      return u.searchParams.get('v');
    }
  } catch {}
  return null;
}

// Extracts cast hash (and author username, when present) from Farcaster/Warpcast
// cast URLs. The hash may be a short prefix (farcaster.xyz uses ~8 hex chars):
//   farcaster.xyz/~/c/[network:]0xhash        → no username
//   farcaster.xyz/username/0xhash             → username captured
//   warpcast.com/username/0xhash              → username captured
//   warpcast.com/~/conversations/0xhash       → no username
export function parseFarcasterCastUrl(url: string): { hash: string; username: string | null } | null {
  // ~/c and ~/conversations forms — no username in the path
  const canonical = url.match(
    /(?:www\.)?(?:farcaster\.xyz\/~\/c|warpcast\.com\/~\/conversations)\/(?:[a-z]+:)?(0x[a-fA-F0-9]+)/i
  );
  if (canonical) return { hash: canonical[1], username: null };

  // username/0xhash form
  const withUser = url.match(
    /(?:www\.)?(?:farcaster\.xyz|warpcast\.com)\/([^/~][^/]*)\/(0x[a-fA-F0-9]+)/i
  );
  if (withUser) return { hash: withUser[2], username: withUser[1] };

  return null;
}

/** Find every Farcaster/Warpcast cast URL inside a block of cast text. */
export function findFarcasterCastUrls(
  text: string
): Array<{ url: string; hash: string; username: string | null }> {
  if (!text) return [];
  const urls = text.match(/https?:\/\/[^\s]+/gi) ?? [];
  const out: Array<{ url: string; hash: string; username: string | null }> = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const url = raw.replace(/[),.]+$/, ''); // trim trailing punctuation
    const parsed = parseFarcasterCastUrl(url);
    if (parsed && !seen.has(parsed.hash.toLowerCase())) {
      seen.add(parsed.hash.toLowerCase());
      out.push({ url, ...parsed });
    }
  }
  return out;
}

export default function EmbedRenderer({ embed, index }: { embed: any; index: number }) {
  if (!embed) return null;

  const embedUrl: string = typeof embed === 'string' ? embed : embed.url;
  if (!embedUrl || typeof embedUrl !== 'string') return null;

  // Image
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(embedUrl) ||
    embedUrl.includes('imagedelivery.net') ||
    embedUrl.includes('imgur.com') ||
    embedUrl.includes('imgbb.com') ||
    embedUrl.includes('i.ibb.co') ||
    embedUrl.includes('cloudinary.com') ||
    embedUrl.includes('media.discordapp.net') ||
    embedUrl.includes('pbs.twimg.com');

  if (isImage) {
    return (
      <a href={embedUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={embedUrl}
          alt="Cast embed"
          className="max-w-full h-auto rounded-lg border border-zinc-800"
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </a>
    );
  }

  // Video — mp4/webm/mov + HLS (.m3u8) + Farcaster stream CDN
  const isVideo = /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(embedUrl) ||
    embedUrl.includes('stream.farcaster.xyz') ||
    embedUrl.includes('video.farcaster.xyz');

  if (isVideo) {
    return (
      <video
        className="max-w-full w-full rounded-lg border border-zinc-800 bg-black"
        controls
        playsInline
      >
        <source src={embedUrl} type={embedUrl.includes('.m3u8') ? 'application/x-mpegURL' : undefined} />
      </video>
    );
  }

  if (!embedUrl.startsWith('http')) return null;

  // YouTube embed
  const youtubeId = parseYouTubeId(embedUrl);
  if (youtubeId) {
    return (
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 12, overflow: 'hidden' }}>
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}`}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // Farcaster cast link → inline quote-cast card
  const fc = parseFarcasterCastUrl(embedUrl);
  if (fc) {
    return <FarcasterCastEmbed hash={fc.hash} username={fc.username} originalUrl={embedUrl} />;
  }

  // SmartEmbed: probes for Frame + Snap in parallel, falls back to UrlPreview
  return <SmartEmbed url={embedUrl} />;
}
