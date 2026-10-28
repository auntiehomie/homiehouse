import type { RecentInteraction } from '@/lib/recent-interactions';

export type ComposeInspirationKind = 'recent_cast' | 'note' | 'reaction';

export interface ComposeInspirationSource {
  id: string;
  kind: ComposeInspirationKind;
  label: string;
  headline: string;
  text: string;
  title?: string;
  authorUsername?: string;
  channelId?: string;
}

interface LocalNote {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  tags?: unknown;
  updatedAt?: unknown;
}

function cleanText(value: unknown, max = 1000): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function castText(cast: Record<string, unknown>): string {
  return cleanText(cast.text ?? cast.body);
}

function nestedString(value: unknown, key: string): string {
  if (!value || typeof value !== 'object') return '';
  return cleanText((value as Record<string, unknown>)[key]);
}

export function recentCastSources(value: unknown): ComposeInspirationSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index): ComposeInspirationSource[] => {
    if (!item || typeof item !== 'object') return [];
    const cast = item as Record<string, unknown>;
    const text = castText(cast);
    if (!text || cast.parent_hash || cast.parentHash) return [];
    const hash = cleanText(cast.hash, 128) || `recent-${index}`;
    return [{
      id: `cast-${hash}`,
      kind: 'recent_cast',
      label: 'Continue a thought',
      headline: text,
      text,
      authorUsername: nestedString(cast.author, 'username').slice(0, 40) || undefined,
      channelId: nestedString(cast.channel, 'id').slice(0, 40) || undefined,
    }];
  });
}

export function noteSources(value: unknown): ComposeInspirationSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index): ComposeInspirationSource[] => {
    if (!item || typeof item !== 'object') return [];
    const note = item as LocalNote;
    const text = cleanText(note.content);
    if (!text) return [];
    const title = cleanText(note.title, 120);
    const tags = Array.isArray(note.tags) ? note.tags : [];
    const savedCast = tags.includes('saved-cast');
    return [{
      id: `note-${cleanText(note.id, 128) || index}`,
      kind: 'note',
      label: savedCast ? 'From a saved cast' : 'From your notes',
      headline: title || text,
      text,
      title: title || undefined,
    }];
  });
}

export function reactionSources(value: RecentInteraction[]): ComposeInspirationSource[] {
  return value.flatMap((interaction): ComposeInspirationSource[] => {
    const text = cleanText(interaction.text);
    if (!text) return [];
    return [{
      id: `reaction-${interaction.type}-${interaction.castHash}`,
      kind: 'reaction',
      label: interaction.type === 'recast' ? 'Inspired by a recast' : 'Inspired by a like',
      headline: text,
      text,
      authorUsername: interaction.authorUsername,
      channelId: interaction.channelId,
    }];
  });
}

export function selectInspirationSources(
  groups: ComposeInspirationSource[][],
  offset = 0,
): ComposeInspirationSource[] {
  return groups.flatMap((group) => group.length ? [group[offset % group.length]] : []);
}

export function fallbackComposeDrafts(source: ComposeInspirationSource): string[] {
  const excerpt = source.text.replace(/\s+/g, ' ').trim().slice(0, 220);
  if (source.kind === 'note') {
    const prefix = source.title ? `${source.title}: ` : '';
    return [`${prefix}${excerpt}`.slice(0, 320)];
  }
  if (source.kind === 'reaction') {
    return [`A recent cast got me thinking: ${excerpt}`.slice(0, 320)];
  }
  return [`I've been thinking more about this: ${excerpt}`.slice(0, 320)];
}

export function parseComposeDrafts(value: unknown, source: ComposeInspirationSource): string[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { drafts?: unknown[] }).drafts)
      ? (value as { drafts: unknown[] }).drafts
      : [];
  const drafts = raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().replace(/^['\"]|['\"]$/g, '').slice(0, 320))
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
    .slice(0, 2);
  return drafts.length ? drafts : fallbackComposeDrafts(source);
}
