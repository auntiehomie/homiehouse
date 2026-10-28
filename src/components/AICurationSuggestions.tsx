"use client";

import { useEffect, useState } from 'react';
import {
  findMatchingCurationRule,
  type CastForCuration,
  type CurationSuggestion,
  type SavedCurationRule,
} from '@/lib/curation-suggestions';
import { getAuthHeaders } from '@/lib/client-auth';

const RULES_KEY = 'hh_ai_curation_rules';

function loadRules(): SavedCurationRule[] {
  try {
    const value = JSON.parse(localStorage.getItem(RULES_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function rememberRule(suggestion: CurationSuggestion) {
  const rules = loadRules().filter(
    (rule) => rule.listName.toLowerCase() !== suggestion.listName.toLowerCase(),
  );
  rules.unshift({ ...suggestion, createdAt: Date.now() });
  localStorage.setItem(RULES_KEY, JSON.stringify(rules.slice(0, 40)));
}

interface AICurationSuggestionsProps {
  fid: number;
  cast: CastForCuration;
  onChoose: (listName: string) => void;
}

export default function AICurationSuggestions({ fid, cast, onChoose }: AICurationSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<CurationSuggestion[]>([]);
  const [remembered, setRemembered] = useState<SavedCurationRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const matched = findMatchingCurationRule(cast, loadRules());
    setRemembered(matched);
    setLoading(true);
    setError(null);

    const authHeaders = getAuthHeaders();
    fetch('/api/curation/suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(authHeaders ?? {}) },
      body: JSON.stringify({ fid, cast }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not suggest a list');
        if (active) setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not suggest a list');
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [fid, cast.text, cast.channelId, cast.authorUsername]);

  return (
    <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: 'rgba(232,119,34,0.08)', border: '1px solid rgba(232,119,34,0.25)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🏠 Homie’s list suggestions</div>

      {remembered ? (
        <button
          type="button"
          className="btn"
          onClick={() => onChoose(remembered.listName)}
          style={{ width: '100%', textAlign: 'left', marginBottom: 8 }}
        >
          Previously learned: {remembered.listName}
        </button>
      ) : null}

      {loading ? <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-on-dark)' }}>Finding the best destination…</p> : null}
      {error ? <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--muted-on-dark)' }}>{error}</p> : null}

      {!loading && suggestions.map((suggestion) => (
        <div key={suggestion.listName} style={{ padding: '9px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{suggestion.listName}</div>
          <p style={{ margin: '3px 0 8px', fontSize: 12, color: 'var(--muted-on-dark)' }}>{suggestion.reason}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => onChoose(suggestion.listName)} style={{ fontSize: 12, padding: '6px 9px' }}>
              Use once
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => { rememberRule(suggestion); setRemembered({ ...suggestion, createdAt: Date.now() }); onChoose(suggestion.listName); }}
              style={{ fontSize: 12, padding: '6px 9px' }}
            >
              Use + remember similar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
