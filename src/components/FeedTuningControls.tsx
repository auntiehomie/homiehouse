'use client';

import { useState } from 'react';
import { defaultTuning, loadFeedTuning, saveFeedTuning, type Discovery } from '@/lib/like-curation';

export default function FeedTuningControls({ fid }: { fid: unknown }) {
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(() => loadFeedTuning(fid).discovery);
  if (!Number.isSafeInteger(Number(fid)) || Number(fid) <= 0) return null;
  return <details className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
    <summary className="cursor-pointer">Tune your feed</summary>
    <div className="flex flex-wrap gap-2 py-3">
      {(['focused', 'balanced', 'explore'] as Discovery[]).map(mode => <button type="button" className="btn" aria-pressed={selected === mode} key={mode} onClick={() => {
        const saved = saveFeedTuning(fid, { ...loadFeedTuning(fid), discovery: mode });
        if (saved) setSelected(mode);
        setMessage(saved ? `${mode === 'focused' ? 'Familiar interests' : mode === 'explore' ? 'More discovery' : 'Balanced'} selected. Applies to future Community pages.` : 'Unable to save on this device.');
      }}>{mode === 'focused' ? 'Familiar interests' : mode === 'explore' ? 'More discovery' : 'Balanced'}</button>)}
      <button type="button" className="btn" onClick={() => { const saved = saveFeedTuning(fid, defaultTuning()); if (saved) setSelected('balanced'); setMessage(saved ? 'Feed tuning reset. Applies to future Community pages.' : 'Unable to save on this device.'); }}>Reset feed tuning</button>
    </div>
    <p className="text-sm">Saved for this account on this device.</p>
    <p className="text-sm" role="status">{message}</p>
  </details>;
}
