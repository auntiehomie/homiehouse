'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChannelSidebar } from '@/components/ChannelStrip';

interface Cast {
  hash: string;
  text: string;
  timestamp: number;
  embeds: any[];
}

interface DuplicateGroup {
  text: string;
  casts: Cast[];
}

export default function CleanupPage() {
  const router = useRouter();
  const [fid, setFid] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('hh_fid');
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) setFid(parsed);
    }
  }, []);

  async function scan() {
    if (!fid) return;
    setLoading(true);
    setError('');
    setGroups([]);
    setDone(false);
    try {
      const res = await fetch(`/api/my-casts?fid=${fid}&limit=200`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch casts');

      const casts: Cast[] = data.casts ?? [];

      // Group by normalized text
      const map = new Map<string, Cast[]>();
      for (const c of casts) {
        const key = c.text.trim();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      }

      // Keep only groups with duplicates, sorted newest first
      const dupes: DuplicateGroup[] = [];
      for (const [text, group] of map.entries()) {
        if (group.length > 1) {
          dupes.push({
            text,
            casts: [...group].sort((a, b) => b.timestamp - a.timestamp),
          });
        }
      }
      setGroups(dupes);
      if (dupes.length === 0) setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteCast(hash: string) {
    if (!fid || deleting.has(hash) || deleted.has(hash)) return;
    setDeleting((prev) => new Set(prev).add(hash));
    try {
      const res = await fetch('/api/delete-cast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fid, cast_hash: hash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Delete failed');
      setDeleted((prev) => new Set(prev).add(hash));
    } catch (e: any) {
      setError(`Failed to delete ${hash.slice(0, 10)}…: ${e.message}`);
    } finally {
      setDeleting((prev) => { const s = new Set(prev); s.delete(hash); return s; });
    }
  }

  async function deleteAllDuplicatesInGroup(group: DuplicateGroup) {
    // Keep the most recent (index 0), delete the rest
    const toDelete = group.casts.slice(1).map((c) => c.hash).filter((h) => !deleted.has(h));
    for (const hash of toDelete) {
      await deleteCast(hash);
      // small delay to avoid hammering the hub
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  async function deleteAll() {
    for (const group of groups) {
      await deleteAllDuplicatesInGroup(group);
    }
  }

  const totalDupes = groups.reduce((n, g) => n + g.casts.length - 1, 0);
  const totalDeleted = groups.reduce(
    (n, g) => n + g.casts.slice(1).filter((c) => deleted.has(c.hash)).length,
    0,
  );

  return (
    <div style={{ display: 'flex', minHeight: '100svh', background: 'var(--bg-dark)' }}>
      <ChannelSidebar />
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 80px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', fontSize: 22, padding: '4px 8px 4px 0' }}>←</button>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-on-dark)' }}>Duplicate Cast Cleanup</h1>
              <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0 }}>Find and delete casts posted multiple times</p>
            </div>
          </div>

          {!fid && (
            <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 14 }}>
              Not signed in — open the app from your Farcaster account first.
            </div>
          )}

          {fid && (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
                <button
                  onClick={scan}
                  disabled={loading}
                  style={{
                    padding: '10px 20px', borderRadius: 10, border: 'none',
                    background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Scanning…' : 'Scan my casts'}
                </button>
                {groups.length > 0 && totalDupes > totalDeleted && (
                  <button
                    onClick={deleteAll}
                    style={{
                      padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.5)',
                      background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Delete all {totalDupes - totalDeleted} duplicates
                  </button>
                )}
              </div>

              {error && (
                <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 13 }}>
                  {error}
                </div>
              )}

              {done && groups.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted-on-dark)', fontSize: 14 }}>
                  ✅ No duplicate casts found in your last 200 casts.
                </div>
              )}

              {totalDeleted > 0 && totalDeleted === totalDupes && (
                <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac', fontSize: 13 }}>
                  ✅ All {totalDeleted} duplicate{totalDeleted > 1 ? 's' : ''} deleted successfully.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {groups.map((group) => {
                  const dupeHashes = group.casts.slice(1).map((c) => c.hash);
                  const allDeleted = dupeHashes.every((h) => deleted.has(h));
                  return (
                    <div
                      key={group.casts[0].hash}
                      style={{
                        background: 'var(--surface)', border: `1px solid ${allDeleted ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                        borderRadius: 12, padding: '14px 16px',
                        opacity: allDeleted ? 0.5 : 1,
                      }}
                    >
                      <p style={{ fontSize: 13, color: 'var(--text-on-dark)', margin: '0 0 10px', lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {group.text.length > 120 ? group.text.slice(0, 120) + '…' : group.text || <em style={{ color: 'var(--muted-on-dark)' }}>(no text)</em>}
                      </p>
                      <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', marginBottom: 10 }}>
                        {group.casts.length} copies — keeping newest, deleting {dupeHashes.length}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {group.casts.map((cast, i) => {
                          const isKeep = i === 0;
                          const isDel = deleted.has(cast.hash);
                          const isDeleting = deleting.has(cast.hash);
                          return (
                            <div key={cast.hash} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--muted-on-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                                {cast.hash.slice(0, 16)}…
                              </span>
                              {isKeep ? (
                                <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>keep (newest)</span>
                              ) : isDel ? (
                                <span style={{ fontSize: 11, color: '#86efac' }}>✓ deleted</span>
                              ) : (
                                <button
                                  onClick={() => deleteCast(cast.hash)}
                                  disabled={isDeleting}
                                  style={{
                                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                    border: '1px solid rgba(239,68,68,0.4)',
                                    background: 'rgba(239,68,68,0.1)', color: '#fca5a5',
                                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                                    opacity: isDeleting ? 0.5 : 1,
                                  }}
                                >
                                  {isDeleting ? 'Deleting…' : 'Delete'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {!allDeleted && (
                        <button
                          onClick={() => deleteAllDuplicatesInGroup(group)}
                          style={{
                            marginTop: 10, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                            border: '1px solid rgba(239,68,68,0.4)',
                            background: 'rgba(239,68,68,0.08)', color: '#fca5a5', cursor: 'pointer',
                          }}
                        >
                          Delete all duplicates in this group
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
