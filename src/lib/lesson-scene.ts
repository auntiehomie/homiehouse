/** Bounded, data-only plans: no generated code, markup, URLs, or arbitrary SVG. */
export type LessonScene =
  | { source: string; layout: 'network' | 'sequence' | 'comparison'; labels: string[] }
  | { source: string; layout: 'tokenization'; sample?: string };

function describesModelTokens(text: string): boolean {
  return /\b(?:tokeniz\w*|tokens?)\b/i.test(text)
    && /\b(?:text|words?|strings?|characters?)\b/i.test(text)
    && /\b(?:models?|llms?|tokenizer|token ids?)\b/i.test(text);
}

export function normalizeLessonScenes(input: unknown, explanation: string): LessonScene[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 6).flatMap((item): LessonScene[] => {
    if (!item || typeof item !== 'object') return [];
    const value = item as Record<string, unknown>;
    if (typeof value.source !== 'string' || value.source.length < 10 || value.source.length > 500 || !explanation.includes(value.source)) return [];
    if (value.layout === 'tokenization') {
      if (!describesModelTokens(value.source)) return [];
      const sample = typeof value.sample === 'string' && value.sample.length <= 48 && value.sample.trim()
        ? value.sample.trim() : undefined;
      return [{ source: value.source, layout: 'tokenization', sample }];
    }
    if (value.layout !== 'network' && value.layout !== 'sequence' && value.layout !== 'comparison') return [];
    if (!Array.isArray(value.labels) || value.labels.length < 2 || value.labels.length > 3) return [];
    const labels = value.labels.map(label => typeof label === 'string' ? label.trim() : label);
    const source = value.source;
    if (!labels.every((label): label is string => typeof label === 'string' && label.trim().length > 0 && label.length <= 22 && source.toLowerCase().includes(label.toLowerCase()))) return [];
    return [{ source: value.source, layout: value.layout, labels }];
  });
}

export function sceneForText(scenes: LessonScene[] | undefined, text: string): LessonScene | undefined {
  return scenes?.find(scene => text.includes(scene.source));
}

/** Covers existing cached and curated lessons only when the relationship is explicit. */
export function sceneForExistingText(text: string): LessonScene | undefined {
  if (describesModelTokens(text) && /\b(?:tokeniz\w*|encod\w*|split\w*|chunks?|ids?)\b/i.test(text)) {
    return { source: text, layout: 'tokenization' };
  }
  if (/decentrali[sz]/i.test(text) && /independent nodes/i.test(text)) {
    return { source: text, layout: 'network', labels: ['independent nodes', 'independent nodes', 'independent nodes'] };
  }
  return undefined;
}
