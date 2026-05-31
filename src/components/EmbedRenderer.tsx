"use client";

import React from 'react';
import SnapEmbed from './SnapEmbed';
import FarcasterCastEmbed from './FarcasterCastEmbed';

// Extracts cast hash from farcaster.xyz/~/c/[network:]0xhash URLs
function parseFarcasterCastUrl(url: string): string | null {
  const m = url.match(/(?:www\.)?farcaster\.xyz\/~\/c\/(?:[a-z]+:)?(0x[a-fA-F0-9]+)/i);
  return m ? m[1] : null;
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

  // Farcaster cast link → inline quote-cast card
  const castHash = parseFarcasterCastUrl(embedUrl);
  if (castHash) {
    return <FarcasterCastEmbed hash={castHash} originalUrl={embedUrl} />;
  }

  // Everything else → SnapEmbed (probes for snap, falls back to UrlPreview)
  return <SnapEmbed url={embedUrl} />;
}
