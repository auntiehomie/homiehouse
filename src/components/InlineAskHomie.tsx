'use client';

import { useEffect, useRef, useState } from 'react';
import { getAuthHeaders } from '@/lib/client-auth';
import { openComposeModal } from '@/lib/compose-modal-events';
import { requestInlineCastAction, type InlineCast, type InlineCastAction } from '@/lib/inline-ask-homie';

export default function InlineAskHomie({ cast }: { cast: InlineCast }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [action, setAction] = useState<InlineCastAction>('summarize');
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [cast.hash]);

  async function run(next: InlineCastAction) {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setAction(next); setBusy(true); setError(''); setResult('');
    try {
      const text = await requestInlineCastAction(cast, next, { ...getAuthHeaders('read:all') }, fetch, request.signal);
      if (!request.signal.aborted) setResult(text);
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'Ask Homie is unavailable.');
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }

  return <div onClick={event => event.stopPropagation()} style={{ marginTop: 10 }}>
    <button type="button" className="btn" aria-expanded={open} onClick={() => {
      if (open) { controller.current?.abort(); setBusy(false); }
      setOpen(!open);
    }}>Ask Homie {open ? '−' : '+'}</button>
    {open && <section aria-label="Ask Homie about this cast" className="surface" style={{ marginTop: 8, padding: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="btn" disabled={busy} onClick={() => void run('summarize')}>Summarize thread</button>
        <button type="button" className="btn" disabled={busy} onClick={() => void run('reply')}>Draft reply</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>AI may be wrong. Uses a partial thread sample and your Ask Homie allowance. Drafts are never posted automatically.</p>
      {busy && <p role="status">Asking Homie…</p>}
      {error && <p role="alert">{error}</p>}
      {result && <div role="status">
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{result}</p>
        {action === 'reply' && <button type="button" className="btn" disabled={!cast.author?.fid} onClick={() => openComposeModal({
          text: result, parentCastHash: cast.hash, parentCastFid: cast.author?.fid,
          replyingToName: cast.author?.username,
        })}>Review & edit reply</button>}
      </div>}
    </section>}
  </div>;
}
