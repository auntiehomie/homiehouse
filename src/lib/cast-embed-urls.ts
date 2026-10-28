/** Combine declared attachments and text links without duplicate previews. */
export function castEmbedUrls(text: string, embeds: unknown = []): string[] {
  const candidates = [
    ...(Array.isArray(embeds) ? embeds.map(embed => typeof embed === 'string' ? embed : embed?.url) : []),
    ...(text.match(/https?:\/\/[^\s<>]+/gi) ?? []).map(url => url.replace(/[),.!?;]+$/, '')),
  ];
  const seen = new Set<string>();
  return candidates.filter((value): value is string => {
    if (typeof value !== 'string') return false;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || seen.has(url.href)) return false;
      seen.add(url.href);
      return true;
    } catch { return false; }
  }).slice(0, 6);
}
