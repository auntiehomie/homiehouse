export const LESSON_CORRECTION_CATEGORIES = [
  'factually_incorrect',
  'outdated',
  'missing_source',
  'unclear',
  'other',
] as const;

export type LessonCorrectionCategory = (typeof LESSON_CORRECTION_CATEGORIES)[number];

export interface LessonCorrectionReportInput {
  moduleId: string;
  moduleTitle: string;
  stepNumber: number;
  cardLabel: string;
  category: LessonCorrectionCategory;
  report: string;
  suggestedCorrection: string | null;
  sourceUrl: string | null;
}

export type LessonCorrectionReportParseResult =
  | { ok: true; value: LessonCorrectionReportInput }
  | { ok: false; error: string };

function readText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

export function parseLessonCorrectionReportInput(value: unknown): LessonCorrectionReportParseResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'A report is required.' };
  }

  const input = value as Record<string, unknown>;
  const moduleId = readText(input.moduleId, 120);
  const moduleTitle = readText(input.moduleTitle, 240);
  const cardLabel = readText(input.cardLabel, 120);
  const report = readText(input.report, 2000);
  const suggestedCorrection = input.suggestedCorrection === '' || input.suggestedCorrection == null
    ? null
    : readText(input.suggestedCorrection, 2000);
  const sourceUrlText = input.sourceUrl === '' || input.sourceUrl == null
    ? null
    : readText(input.sourceUrl, 2048);

  if (!moduleId || !moduleTitle || !cardLabel) {
    return { ok: false, error: 'Lesson and step details are required.' };
  }
  if (!Number.isInteger(input.stepNumber) || Number(input.stepNumber) < 1 || Number(input.stepNumber) > 500) {
    return { ok: false, error: 'The lesson step is invalid.' };
  }
  if (!LESSON_CORRECTION_CATEGORIES.includes(input.category as LessonCorrectionCategory)) {
    return { ok: false, error: 'Choose a report category.' };
  }
  if (!report || report.length < 8) {
    return { ok: false, error: 'Describe what needs correction (at least 8 characters).' };
  }
  if (input.suggestedCorrection != null && input.suggestedCorrection !== '' && !suggestedCorrection) {
    return { ok: false, error: 'The suggested correction is too long.' };
  }

  let sourceUrl: string | null = null;
  if (sourceUrlText) {
    try {
      const parsedUrl = new URL(sourceUrlText);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        return { ok: false, error: 'Use an http or https source link.' };
      }
      sourceUrl = parsedUrl.toString();
    } catch {
      return { ok: false, error: 'Enter a valid source link.' };
    }
  } else if (input.sourceUrl != null && input.sourceUrl !== '') {
    return { ok: false, error: 'The source link is too long.' };
  }

  return {
    ok: true,
    value: {
      moduleId,
      moduleTitle,
      stepNumber: Number(input.stepNumber),
      cardLabel,
      category: input.category as LessonCorrectionCategory,
      report,
      suggestedCorrection,
      sourceUrl,
    },
  };
}
