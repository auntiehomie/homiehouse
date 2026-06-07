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

// Extracts cast hash from Farcaster/Warpcast cast URLs:
//   farcaster.xyz/~/c/[network:]0xhash
//   farcaster.xyz/username/0xhash
//   warpcast.com/username/0xhash
//   warpcast.com/~/conversations/0xhash
function parseFarcasterCastUrl(url: string): string | null {
  const patterns = [
    /(?:www\.)?farcaster\.xyz\/~\/c\/(?:[a-z]+:)?(0x[a-fA-F0-9]+)/i,
    /(?:www\.)?farcaster\.xyz\/[^/]+\/(0x[a-fA-F0-9]+)/i,
    /(?:www\.)?warpcast\.com\/[^/]+\/(0x[a-fA-F0-9]+)/i,
    /(?:www\.)?warpcast\.com\/~\/conversations\/(0x[a-fA-F0-9]+)/i,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
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
  const castHash = parseFarcasterCastUrl(embedUrl);
  if (castHash) {
    return <FarcasterCastEmbed hash={castHash} originalUrl={embedUrl} />;
  }

  // SmartEmbed: probes for Frame + Snap in parallel, falls back to UrlPreview
  return <SmartEmbed url={embedUrl} />;
}
