'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import AppShell from '@/components/AppShell';
import { openMiniApp } from '@/lib/farcaster';
import { getAuthHeaders } from '@/lib/client-auth';
import { useFarcasterAuth } from '@/lib/farcaster-auth';

interface SavedApp {
  id?: string;
  app_id: string;
  app_data: { url?: string; title?: string } | string;
  saved_at?: string;
}

function appDetails(app: SavedApp): { url: string; title: string } | null {
  let data = app.app_data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data) as SavedApp['app_data']; } catch { return null; }
  }
  if (!data || typeof data !== 'object') return null;

  const url = typeof data.url === 'string' ? data.url : app.app_id;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
    return { url: parsed.toString(), title: data.title?.trim() || parsed.hostname };
  } catch {
    return null;
  }
}

function parseMiniAppUrl(value: string): { url: string; title: string } {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('Enter a secure HTTPS Mini App URL.');
  }
  return { url: parsed.toString(), title: parsed.hostname };
}

export default function AppsPage() {
  const { fid, isAuthenticated } = useFarcasterAuth();
  const [apps, setApps] = useState<SavedApp[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    if (!isAuthenticated) {
      setApps([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/saved-apps', {
        headers: { ...(getAuthHeaders('read:all') ?? {}) },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load saved apps.');
      setApps(Array.isArray(data.apps) ? data.apps : []);
      setLoadError(null);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Could not load saved apps.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { void loadApps(); }, [loadApps]);

  const launch = (url: string, title: string) => {
    setError(null);
    openMiniApp(url, title);
  };

  const addApp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    let app: { url: string; title: string };
    try {
      app = parseMiniAppUrl(urlInput);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enter a valid Mini App URL.');
      return;
    }

    if (!isAuthenticated || !fid) {
      launch(app.url, app.title);
      setMessage('App opened. Sign in to save it to your Apps list.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/saved-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getAuthHeaders('write:profile') ?? {}) },
        body: JSON.stringify({ fid, app_id: app.url, app_data: app }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save this app.');
      setApps(current => [data.app, ...current.filter(item => item.app_id !== app.url)]);
      setUrlInput('');
      setMessage('Saved to your Apps list.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this app.');
    } finally {
      setSaving(false);
    }
  };

  const removeApp = async (appId: string) => {
    if (!fid) return;
    setRemoving(appId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/saved-apps', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(getAuthHeaders('write:profile') ?? {}) },
        body: JSON.stringify({ fid, app_id: appId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not remove this app.');
      setApps(current => current.filter(app => app.app_id !== appId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove this app.');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-4xl px-3 pb-24 pt-5 sm:px-6 lg:pt-8">
        <header className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">HomieHouse</p>
          <h1 className="text-3xl font-bold text-white">Apps</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Open Mini Apps in HomieHouse and keep the ones you use in one place.
          </p>
        </header>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-white">Add a Mini App</h2>
          <p className="mt-1 text-sm text-zinc-400">Paste its HTTPS URL to save it to your launch list.</p>
          <form onSubmit={addApp} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://example.com/app"
              value={urlInput}
              onChange={event => setUrlInput(event.target.value)}
              aria-label="Mini App URL"
              className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500"
            />
            <button
              type="submit"
              disabled={saving || !urlInput.trim()}
              className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : isAuthenticated ? 'Save app' : 'Open app'}
            </button>
          </form>
          {!isAuthenticated && (
            <p className="mt-3 text-xs text-zinc-500">You can open an app now. Sign in to save it for later.</p>
          )}
          {message && <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
        </section>

        <section className="mb-7">
          <h2 className="mb-3 text-lg font-semibold text-white">HomieHouse apps</h2>
          <article className="flex items-center gap-3 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-950/60 to-zinc-900/60 p-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-lg" aria-hidden="true">✦</div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-white">Ask Homie</h3>
              <p className="mt-0.5 text-xs text-zinc-400">Ask questions and explore conversations with Homie.</p>
            </div>
            <button
              type="button"
              onClick={() => launch(`${window.location.origin}/mini/ask-homie`, 'Ask Homie')}
              className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              Open
            </button>
          </article>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Your apps</h2>
            {isAuthenticated && (
              <button type="button" onClick={() => void loadApps()} className="text-xs font-medium text-zinc-400 hover:text-white">
                Refresh
              </button>
            )}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm text-zinc-400">Loading your apps…</div>
          ) : apps.map(saved => {
            const app = appDetails(saved);
            if (!app) return null;
            return (
              <article key={saved.app_id} className="mb-3 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200" aria-hidden="true">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" strokeWidth={2} />
                    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" strokeWidth={2} />
                    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" strokeWidth={2} />
                    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" strokeWidth={2} />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-white">{app.title}</h3>
                  <p className="truncate text-xs text-zinc-500">{new URL(app.url).hostname}</p>
                </div>
                <button type="button" onClick={() => launch(app.url, app.title)} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700">
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => void removeApp(saved.app_id)}
                  disabled={removing === saved.app_id}
                  aria-label={`Remove ${app.title}`}
                  className="rounded-lg px-2 py-2 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-50"
                >
                  {removing === saved.app_id ? '…' : 'Remove'}
                </button>
              </article>
            );
          })}

          {!loading && loadError && (
            <div role="alert" className="rounded-2xl border border-rose-900/70 bg-rose-950/30 p-5 text-sm text-rose-200">
              {loadError}{' '}
              <button type="button" onClick={() => void loadApps()} className="font-semibold underline underline-offset-2">Try again</button>
            </div>
          )}

          {!loading && !loadError && apps.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 p-6 text-center">
              <p className="text-sm font-medium text-zinc-200">No saved apps yet</p>
              <p className="mt-1 text-sm text-zinc-500">Add a Mini App URL above, or open one from a cast in your feed.</p>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
