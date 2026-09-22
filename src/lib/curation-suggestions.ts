export interface CastForCuration {
  text: string;
  channelId?: string;
  authorUsername?: string;
}

export interface CurationSuggestion {
  listName: string;
  reason: string;
  keywords: string[];
  channelId?: string;
  authorUsername?: string;
}

export interface SavedCurationRule extends CurationSuggestion {
  createdAt: number;
}

const GENERIC_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'being', 'cast', 'could', 'from',
  'have', 'just', 'more', 'some', 'that', 'their', 'there', 'these', 'they',
  'this', 'what', 'when', 'where', 'which', 'with', 'would', 'your',
]);

function cleanWords(text: string): string[] {
  return [...new Set(
    text
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, ' ')
      .match(/[a-z0-9][a-z0-9-]{3,}/g)
      ?.filter((word) => !GENERIC_WORDS.has(word)) ?? [],
  )].slice(0, 5);
}

function cleanListName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/[\r\n]+/g, ' ').slice(0, 60);
  return name.length >= 2 ? name : null;
}

function cleanReason(value: unknown): string {
  if (typeof value !== 'string') return 'Matches the cast topic and context.';
  return value.trim().replace(/[\r\n]+/g, ' ').slice(0, 180) || 'Matches the cast topic and context.';
}

export function fallbackCurationSuggestions(
  cast: CastForCuration,
  existingLists: string[] = [],
): CurationSuggestion[] {
  const keywords = cleanWords(cast.text);
  const channel = cast.channelId?.trim().replace(/^\//, '').slice(0, 40);
  const matchingExisting = existingLists.find((name) => {
    const lower = name.toLowerCase();
    return (channel && lower.includes(channel.toLowerCase())) || keywords.some((word) => lower.includes(word));
  });
  const topic = channel || keywords[0] || 'Farcaster';
  const primaryName = matchingExisting || `${topic.charAt(0).toUpperCase()}${topic.slice(1)} Finds`;

  return [{
    listName: primaryName,
    reason: matchingExisting
      ? 'An existing list appears to match this cast.'
      : channel
        ? `This cast is connected to the /${channel} channel.`
        : 'This groups the cast around its strongest topic.',
    keywords,
    channelId: channel || undefined,
    authorUsername: cast.authorUsername?.replace(/^@/, '').slice(0, 40) || undefined,
  }];
}

export function parseCurationSuggestions(
  value: unknown,
  cast: CastForCuration,
  existingLists: string[] = [],
): CurationSuggestion[] {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { suggestions?: unknown[] }).suggestions)
      ? (value as { suggestions: unknown[] }).suggestions
      : [];

  const suggestions = source.flatMap((item): CurationSuggestion[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const listName = cleanListName(record.listName);
    if (!listName) return [];
    const keywords = Array.isArray(record.keywords)
      ? record.keywords
          .filter((keyword): keyword is string => typeof keyword === 'string')
          .map((keyword) => keyword.toLowerCase().trim())
          .filter(Boolean)
          .slice(0, 5)
      : cleanWords(cast.text);
    return [{
      listName,
      reason: cleanReason(record.reason),
      keywords,
      channelId: typeof record.channelId === 'string'
        ? record.channelId.replace(/^\//, '').trim().slice(0, 40) || undefined
        : undefined,
      authorUsername: typeof record.authorUsername === 'string'
        ? record.authorUsername.replace(/^@/, '').trim().slice(0, 40) || undefined
        : undefined,
    }];
  });

  const unique = suggestions.filter(
    (suggestion, index) => suggestions.findIndex(
      (candidate) => candidate.listName.toLowerCase() === suggestion.listName.toLowerCase(),
    ) === index,
  );
  return unique.slice(0, 3).length > 0
    ? unique.slice(0, 3)
    : fallbackCurationSuggestions(cast, existingLists);
}

export function findMatchingCurationRule(
  cast: CastForCuration,
  rules: SavedCurationRule[],
): SavedCurationRule | null {
  const text = cast.text.toLowerCase();
  const channel = cast.channelId?.toLowerCase();
  const author = cast.authorUsername?.replace(/^@/, '').toLowerCase();

  return rules.find((rule) => {
    if (rule.channelId && channel === rule.channelId.toLowerCase()) return true;
    if (rule.authorUsername && author === rule.authorUsername.replace(/^@/, '').toLowerCase()) return true;
    return rule.keywords.some((keyword) => keyword.length >= 4 && text.includes(keyword.toLowerCase()));
  }) ?? null;
}
