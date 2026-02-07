"use client";

import React from 'react';
import UrlPreview from './UrlPreview';

/**
 * Render different types of embeds: images, URLs, mini apps, frames
 */
export default function EmbedRenderer({ embed, index }: { embed: any; index: number }) {
  if (!embed) {
    console.log('[EmbedRenderer] Skipping null/undefined embed');
    return null;
  }

  console.log('[EmbedRenderer] Processing embed:', { index, type: typeof embed, embed: JSON.stringify(embed).substring(0, 200) });

  const embedUrl = embed.url || embed;
  
  if (!embedUrl) {
    console.log('[EmbedRenderer] No embedUrl extracted, skipping');
    return null;
  }

  if (typeof embedUrl !== 'string') {
    console.log('[EmbedRenderer] embedUrl is not a string:', typeof embedUrl);
    return null;
  }

  console.log('[EmbedRenderer] embedUrl:', embedUrl);

  // Image embed
  const isImage = embedUrl.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i) ||
    embedUrl.includes('imagedelivery.net') ||
    embedUrl.includes('imgur.com') ||
    embedUrl.includes('imgbb.com') ||
    embedUrl.includes('i.ibb.co') ||
    embedUrl.includes('cloudinary.com') ||
    embedUrl.includes('media.discordapp.net') ||
    embedUrl.includes('pbs.twimg.com');

  if (isImage) {
    return (
      <a
        key={index}
        href={embedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <img
          src={embedUrl}
          alt="Cast embed"
          className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-zinc-800"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </a>
    );
  }

  // Video embed
  const isVideo = embedUrl.match(/\.(mp4|webm|mov)$/i);
  if (isVideo) {
    return (
      <video
        key={index}
        className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-zinc-800"
        controls
      >
        <source src={embedUrl} />
        Your browser does not support the video tag.
      </video>
    );
  }

  // URL preview embed (for HTTP/HTTPS links)
  if (embedUrl.startsWith('http')) {
    return (
      <div key={index}>
        <UrlPreview url={embedUrl} />
      </div>
    );
  }

  // Unknown embed type
  return null;
}
