import { NextRequest } from 'next/server';
import { GET, PATCH, POST } from '@/app/api/lesson-corrections/route';
import { parseLessonCorrectionReportInput } from '@/lib/lesson-correction-report';
import { correctLessonRepositoryReferences } from '@/lib/lesson-source-corrections';

var dbQuery = jest.fn();
var rateLimitResult = { success: true };

jest.mock('@/lib/db', () => ({ getDb: () => ({ query: (...args: unknown[]) => dbQuery(...args) }) }));
jest.mock('@/lib/ratelimit', () => ({
  checkRateLimit: async () => rateLimitResult,
  rateLimitKeyFromRequest: () => 'ip:test',
}));
jest.mock('@/lib/logger', () => ({
  createApiLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

const validReport = {
  moduleId: 'ecosystem-synthesis',
  moduleTitle: 'Ecosystem Synthesis',
  stepNumber: 14,
  cardLabel: 'Concept 3 of 4 · 4/4',
  category: 'factually_incorrect',
  report: 'The repository link uses the old organization name.',
  suggestedCorrection: 'Use farcasterorg/hypersnap.',
  sourceUrl: 'https://github.com/farcasterorg/hypersnap',
};

describe('lesson correction reporting', () => {
  it('corrects the known stale Hypersnap organization in nested lesson content', () => {
    expect(correctLessonRepositoryReferences({
      explanation: 'See github.com/farcasterxyz/hypersnap for details.',
      links: ['https://github.com/farcasterxyz/hypersnap'],
    })).toEqual({
      explanation: 'See github.com/farcasterorg/hypersnap for details.',
      links: ['https://github.com/farcasterorg/hypersnap'],
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimitResult = { success: true };
    dbQuery.mockResolvedValue({ rows: [] });
  });

  it('validates and normalizes learner-provided correction details', () => {
    expect(parseLessonCorrectionReportInput(validReport)).toEqual({
      ok: true,
      value: { ...validReport, sourceUrl: validReport.sourceUrl },
    });
  });

  it('rejects short reports and unsafe source URL schemes', () => {
    expect(parseLessonCorrectionReportInput({ ...validReport, report: 'wrong' })).toMatchObject({ ok: false });
    expect(parseLessonCorrectionReportInput({ ...validReport, sourceUrl: 'javascript:alert(1)' })).toMatchObject({ ok: false });
  });

  it('stores a report with lesson and step context without storing lesson text automatically', async () => {
    dbQuery.mockImplementation(async (query: string) => {
      if (query.includes('INSERT INTO lesson_correction_reports')) return { rows: [{ id: '3c7a7100-0861-4cf4-9779-6b5dc6732074' }] };
      return { rows: [] };
    });
    const response = await POST(new NextRequest('http://localhost/api/lesson-corrections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validReport, cardText: 'Private lesson text is not accepted as stored context.' }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true, reportId: '3c7a7100-0861-4cf4-9779-6b5dc6732074' });
    const insertCall = dbQuery.mock.calls.find(([query]) => String(query).includes('INSERT INTO lesson_correction_reports'));
    expect(insertCall?.[1]).not.toContain('Private lesson text is not accepted as stored context.');
  });

  it('applies the submission rate limit before writing to the database', async () => {
    rateLimitResult = { success: false };
    const response = await POST(new NextRequest('http://localhost/api/lesson-corrections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validReport),
    }));

    expect(response.status).toBe(429);
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('protects the review queue with MIGRATE_SECRET', async () => {
    const previous = process.env.MIGRATE_SECRET;
    process.env.MIGRATE_SECRET = 'test-secret';
    try {
      const response = await GET(new NextRequest('http://localhost/api/lesson-corrections'));
      expect(response.status).toBe(401);
      expect(dbQuery).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.MIGRATE_SECRET;
      else process.env.MIGRATE_SECRET = previous;
    }
  });

  it('lets an authorized maintainer move a report into a review status', async () => {
    const previous = process.env.MIGRATE_SECRET;
    process.env.MIGRATE_SECRET = 'test-secret';
    dbQuery.mockImplementation(async (query: string) => {
      if (query.includes('UPDATE lesson_correction_reports')) {
        return { rows: [{ id: validReport.moduleId, status: 'resolved', reviewed_at: '2026-10-19T23:00:00Z', resolution_note: 'Corrected in source.' }] };
      }
      return { rows: [] };
    });
    try {
      const response = await PATCH(new NextRequest('http://localhost/api/lesson-corrections', {
        method: 'PATCH',
        headers: { authorization: 'Bearer test-secret', 'content-type': 'application/json' },
        body: JSON.stringify({ id: '3c7a7100-0861-4cf4-9779-6b5dc6732074', status: 'resolved', resolutionNote: 'Corrected in source.' }),
      }));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ ok: true, report: { status: 'resolved' } });
    } finally {
      if (previous === undefined) delete process.env.MIGRATE_SECRET;
      else process.env.MIGRATE_SECRET = previous;
    }
  });
});
