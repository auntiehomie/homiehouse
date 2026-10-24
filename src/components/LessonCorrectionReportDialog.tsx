'use client';

import { useState } from 'react';
import {
  LESSON_CORRECTION_CATEGORIES,
  type LessonCorrectionCategory,
} from '@/lib/lesson-correction-report';

const CATEGORY_LABELS: Record<LessonCorrectionCategory, string> = {
  factually_incorrect: 'Factually incorrect',
  outdated: 'Outdated information',
  missing_source: 'Missing or weak source',
  unclear: 'Unclear or misleading explanation',
  other: 'Something else',
};

interface LessonCorrectionReportDialogProps {
  moduleId: string;
  moduleTitle: string;
  stepNumber: number;
  cardLabel: string;
  onClose: () => void;
}

export default function LessonCorrectionReportDialog({
  moduleId,
  moduleTitle,
  stepNumber,
  cardLabel,
  onClose,
}: LessonCorrectionReportDialogProps) {
  const [category, setCategory] = useState<LessonCorrectionCategory>('factually_incorrect');
  const [report, setReport] = useState('');
  const [suggestedCorrection, setSuggestedCorrection] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/lesson-corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId,
          moduleTitle,
          stepNumber,
          cardLabel,
          category,
          report,
          suggestedCorrection,
          sourceUrl,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Could not submit the report.');
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit the report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', borderRadius: 10,
    border: '1px solid var(--border)', background: 'var(--bg-dark)',
    color: 'var(--text-on-dark)', padding: '12px 13px', fontSize: 14,
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 7, color: 'var(--text-on-dark)',
    fontSize: 13, fontWeight: 700,
  };

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px))',
        background: 'rgba(0,0,0,0.78)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-correction-title"
        style={{
          width: '100%', maxWidth: 520, maxHeight: '90dvh', overflowY: 'auto',
          borderRadius: 18, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text-on-dark)',
          padding: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 id="lesson-correction-title" style={{ margin: '0 0 6px', fontSize: 19, lineHeight: 1.3 }}>
              Help improve this lesson
            </h2>
            <p style={{ margin: 0, color: 'var(--muted-on-dark)', fontSize: 12, lineHeight: 1.5 }}>
              {moduleTitle} · Step {stepNumber}: {cardLabel}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close correction report"
            onClick={onClose}
            style={{ border: 0, background: 'transparent', color: 'var(--muted-on-dark)', fontSize: 24, lineHeight: 1, cursor: 'pointer', padding: 0 }}
          >
            ×
          </button>
        </div>

        {submitted ? (
          <div role="status" style={{ paddingTop: 22 }}>
            <p style={{ margin: '0 0 8px', color: '#86efac', fontSize: 16, fontWeight: 800 }}>Thanks — your report is in the review queue.</p>
            <p style={{ margin: '0 0 20px', color: 'var(--muted-on-dark)', fontSize: 13, lineHeight: 1.6 }}>
              A person will review it before any lesson content changes.
            </p>
            <button type="button" onClick={onClose} style={primaryButtonStyle}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 15, marginTop: 20 }}>
            <p style={{ margin: 0, color: 'var(--muted-on-dark)', fontSize: 12, lineHeight: 1.55 }}>
              We attach the lesson and step number. The card text is not sent automatically; include the specific phrase in your note if it helps.
            </p>

            <div>
              <label htmlFor="lesson-correction-category" style={labelStyle}>What kind of issue is it?</label>
              <select
                id="lesson-correction-category"
                value={category}
                onChange={event => setCategory(event.target.value as LessonCorrectionCategory)}
                style={fieldStyle}
              >
                {LESSON_CORRECTION_CATEGORIES.map(value => (
                  <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="lesson-correction-report" style={labelStyle}>What needs correction?</label>
              <textarea
                id="lesson-correction-report"
                required
                minLength={8}
                maxLength={2000}
                rows={4}
                value={report}
                onChange={event => setReport(event.target.value)}
                placeholder="For example: the repository link points to the old organization."
                style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            <div>
              <label htmlFor="lesson-correction-suggestion" style={labelStyle}>Suggested correction <span style={{ fontWeight: 400, color: 'var(--muted-on-dark)' }}>(optional)</span></label>
              <textarea
                id="lesson-correction-suggestion"
                maxLength={2000}
                rows={3}
                value={suggestedCorrection}
                onChange={event => setSuggestedCorrection(event.target.value)}
                placeholder="What would make this accurate?"
                style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            <div>
              <label htmlFor="lesson-correction-source" style={labelStyle}>Source link <span style={{ fontWeight: 400, color: 'var(--muted-on-dark)' }}>(optional)</span></label>
              <input
                id="lesson-correction-source"
                type="url"
                maxLength={2048}
                value={sourceUrl}
                onChange={event => setSourceUrl(event.target.value)}
                placeholder="https://…"
                style={fieldStyle}
              />
            </div>

            {error && <p role="alert" style={{ margin: 0, color: '#fca5a5', fontSize: 13 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 2 }}>
              <button type="button" onClick={onClose} disabled={submitting} style={secondaryButtonStyle}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...primaryButtonStyle, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  width: '100%', border: 0, borderRadius: 10, padding: '12px 16px',
  background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
  color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 10, padding: '11px 15px',
  background: 'transparent', color: 'var(--muted-on-dark)',
  fontSize: 14, fontWeight: 700, cursor: 'pointer',
};
