'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChannelSidebar } from '@/components/ChannelStrip';

interface Cast {
  hash: string;
  text: string;
  timestamp: number;
}

interface DuplicateGroup {
  text: string;
  keep: Cast;      // newest
  dupes: Cast[];   // everything else — to be deleted
}

export default function CleanupPage() {
  const router = useRouter();
  const [fid, setFid] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const stopRef = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem('hh_fid');
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) setFid(parsed);
    }
  }, []);

  async function scan() {
    if (!fid) return;
    setScanning(true);
    setError('');
    setGroups([]);
    setDeleted(new Set());
    setFailed(new Set());
    setDone(false);
    setScanned(0);

    try {
      const res = await fetch(`/api/my-casts?fid=${fid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch casts');

      const casts: Cast[] = data.casts ?? [];
      setScanned(casts.length);

      // Group by normalized text, sort each group newest first
      const map = new Map<string, Cast[]>();
      for (const c of casts) {
        const key = c.text.trim();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      }

      const dupeGroups: DuplicateGroup[] = [];
      for (const [text, group] of map.entries()) {
        if (group.length > 1) {
          const sorted = [...group].sort((a, b) => b.timestamp - a.timestamp);
          dupeGroups.push({ text, keep: sorted[0], dupes: sorted.slice(1) });
        }
      }

      // Sort by most duplicates first
      dupeGroups.sort((a, b) => b.dupes.length - a.dupes.length);
      setGroups(dupeGroups);
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  }

  async function deleteCastHash(hash: string): Promise<boolean> {
    try {
      const res = await fetch('/api/delete-cast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fid, cast_hash: hash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Delete failed');
      setDeleted((prev) => new Set(prev).add(hash));
      return true;
    } catch {
      setFailed((prev) => new Set(prev).add(hash));
      return false;
    }
  }

  async function deleteAll() {
    stopRef.current = false;
    const allDupes = groups.flatMap((g) => g.dupes).filter((c) => !deleted.has(c.hash));
    if (!allDupes.length) return;

    setDeleting(true);
    setDeleteTotal(allDupes.length);
    setDeleteProgress(0);

    let done = 0;
    for (const cast of allDupes) {
      if (stopRef.current) break;
      await deleteCastHash(cast.hash);
      done++;
      setDeleteProgress(done);
      // Small delay to avoid hammering the hub
      await new Promise((r) => setTimeout(r, 350));
    }

    setDeleting(false);
  }

  function stop() {
    stopRef.current = true;
  }

  const totalDupes = groups.reduce((n, g) => n + g.dupes.length, 0);
  const totalDeleted = groups.reduce((n, g) => n + g.dupes.filter((c) => deleted.has(c.hash)).length, 0);
  const totalFailed = groups.reduce((n, g) => n + g.dupes.filter((c) => failed.has(c.hash)).length, 0);
  const remaining = totalDupes - totalDeleted - totalFailed;

  return (
    <div style={{ display: 'flex', minHeight: '100svh', background: 'var(--bg-dark)' }}>
      <ChannelSidebar />
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 80px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', fontSize: 22, padding: '4px 8px 4px 0' }}>←</button>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-on-dark)' }}>Duplicate Cast Cleanup</h1>
              <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: 0 }}>Find and delete casts posted multiple times by the scheduler</p>
            </div>
          </div>

          {!fid && (
            <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 14 }}>
              Not signed in — open the app from your Farcaster account first.
            </div>
          )}

          {fid && (
            <>
              {/* Scan controls */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={scan}
                  disabled={scanning || deleting}
                  style={{
                    padding: '10px 20px', borderRadius: 10, border: 'none',
                    background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600,
                    cursor: (scanning || deleting) ? 'not-allowed' : 'pointer',
                    opacity: (scanning || deleting) ? 0.6 : 1,
                  }}
                >
                  {scanning ? `Scanning… (${scanned} fetched)` : 'Scan all my casts'}
                </button>

                {totalDupes > 0 && remaining > 0 && !deleting && (
                  <button
                    onClick={deleteAll}
                    style={{
                      padding: '10px 20px', borderRadius: 10,
                      border: '1px solid rgba(239,68,68,0.5)',
                      background: 'rgba(239,68,68,0.12)', color: '#fca5a5',
                      fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    🗑 Delete all {remaining} duplicate{remaining !== 1 ? 's' : ''}
                  </button>
                )}

                {deleting && (
                  <button
                    onClick={stop}
                    style={{
                      padding: '10px 20px', borderRadius: 10,
                      border: '1px solid rgba(251,191,36,0.4)',
                      background: 'rgba(251,191,36,0.08)', color: '#fbbf24',
                      fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    ⏹ Stop
                  </button>
                )}
              </div>

              {/* Delete progress bar */}
              {(deleting || (deleteTotal > 0 && totalDeleted > 0)) && (
                <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-on-dark)', fontWeight: 600 }}>
                      {deleting ? 'Deleting duplicates…' : 'Done'}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>
                      {totalDeleted} / {deleteTotal}
                      {totalFailed > 0 && <span style={{ color: '#fca5a5' }}> · {totalFailed} failed</span>}
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-dark)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4, transition: 'width 0.3s ease',
                      width: `${deleteTotal ? (totalDeleted / deleteTotal) * 100 : 0}%`,
                      background: totalFailed > 0 ? '#f97316' : '#22c55e',
                    }} />
                  </div>
                </div>
              )}

              {error && (
                <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 13 }}>
                  {error}
                </div>
              )}

              {done && groups.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-on-dark)', fontSize: 14 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                  No duplicate casts found in your last {scanned} casts.
                </div>
              )}

              {/* Summary when found */}
              {groups.length > 0 && (
                <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 13 }}>
                  <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                    Found {totalDupes} duplicate{totalDupes !== 1 ? 's' : ''} across {groups.length} cast{groups.length !== 1 ? 's' : ''}
                  </span>
                  {totalDeleted > 0 && (
                    <span style={{ color: '#86efac', marginLeft: 10 }}>· {totalDeleted} deleted</span>
                  )}
                  {remaining > 0 && !deleting && (
                    <span style={{ color: 'var(--muted-on-dark)', marginLeft: 10 }}>· {remaining} remaining</span>
                  )}
                </div>
              )}

              {/* Duplicate groups */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {groups.map((group) => {
                  const groupDeleted = group.dupes.filter((c) => deleted.has(c.hash)).length;
                  const allGone = groupDeleted === group.dupes.length;
                  return (
                    <div
                      key={group.keep.hash}
                      style={{
                        background: 'var(--surface)', border: `1px solid ${allGone ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
                        borderRadius: 12, padding: '14px 16px',
                        opacity: allGone ? 0.45 : 1,
                        transition: 'opacity 0.3s',
                      }}
                    >
                      <p style={{ fontSize: 13, color: 'var(--text-on-dark)', margin: '0 0 8px', lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {group.text.length > 140 ? group.text.slice(0, 140) + '…' : group.text || <em style={{ color: 'var(--muted-on-dark)' }}>(no text)</em>}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>
                          {allGone
                            ? `✓ all ${group.dupes.length} duplicates deleted`
                            : `${group.dupes.length + 1} copies — ${groupDeleted}/${group.dupes.length} duplicates deleted`}
                        </span>
                        {!allGone && !deleting && (
                          <button
                            onClick={async () => {
                              const toDelete = group.dupes.filter((c) => !deleted.has(c.hash) && !failed.has(c.hash));
                              for (const c of toDelete) {
                                await deleteCastHash(c.hash);
                                await new Promise((r) => setTimeout(r, 350));
                              }
                            }}
                            style={{
                              padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                              border: '1px solid rgba(239,68,68,0.4)',
                              background: 'rgba(239,68,68,0.08)', color: '#fca5a5', cursor: 'pointer',
                            }}
                          >
                            Delete {group.dupes.length - groupDeleted} duplicate{group.dupes.length - groupDeleted !== 1 ? 's' : ''}
                          </button>
                        )}
                      </div>
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
