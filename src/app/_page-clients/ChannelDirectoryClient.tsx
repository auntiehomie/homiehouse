'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import {
  addSavedChannel,
  readSavedChannels,
  removeSavedChannel,
  type SavedChannel,
} from '@/lib/channel-preferences';
import SidebarNav from '@/components/SidebarNav';
import HHLogo from '@/components/HHLogo';

type Channel = SavedChannel & { description?: string; member_count?: number; follower_count?: number };

function displayName(channel: Channel): string {
  const name = channel.name?.trim();
  if (name && !name.startsWith('http') && !name.startsWith('chain://')) return name;
  return channel.id.replace(/^\//, '');
}

export default function ChannelDirectoryClient() {
  const { fid } = useFarcasterAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Channel[]>([]);
  const [saved, setSaved] = useState<SavedChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (fid) setSaved(readSavedChannels(fid));
    else setSaved([]);
  }, [fid]);

  const loadChannels = useCallback(async (search: string) => {
    const params = new URLSearchParams({ limit: '100' });
    if (search) params.set('q', search);
    const response = await fetch(`/api/channels?${params}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data?.ok || !Array.isArray(data.channels)) {
      throw new Error(data?.error || `Channel request failed (${response.status}).`);
    }
    return data.channels.flatMap((item: any) => {
      const id = typeof item?.id === 'string' ? item.id.trim() : '';
      if (!id) return [];
      return [{
        id,
        ...(typeof item.name === 'string' ? { name: item.name } : {}),
        ...(typeof item.description === 'string' ? { description: item.description } : {}),
        ...(typeof item.image_url === 'string' ? { image_url: item.image_url } : {}),
        ...(Number.isFinite(item.member_count) ? { member_count: item.member_count } : {}),
        ...(Number.isFinite(item.follower_count) ? { follower_count: item.follower_count } : {}),
      }];
    }) as Channel[];
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setError(null);
      setLoading(!query.trim());
      setSearching(!!query.trim());
      try {
        const channels = await loadChannels(query.trim());
        if (active) setResults(channels);
      } catch (cause: any) {
        if (active) setError(cause?.message || 'Could not load Hypersnap channels.');
      } finally {
        if (active) {
          setLoading(false);
          setSearching(false);
        }
      }
    }, query.trim() ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadChannels, query]);

  const savedIds = useMemo(() => new Set(saved.map(channel => channel.id.toLowerCase())), [saved]);

  function toggleSaved(channel: Channel) {
    if (!fid) {
      setStatus('Sign in to add channels to your list.');
      return;
    }
    const isSaved = savedIds.has(channel.id.toLowerCase());
    const next = isSaved
      ? removeSavedChannel(fid, channel.id)
      : addSavedChannel(fid, { id: channel.id, name: displayName(channel), image_url: channel.image_url });
    setSaved(next);
    setStatus(isSaved ? `Removed /${channel.id} from My Channels.` : `Added /${channel.id} to My Channels.`);
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <header className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
        <Link href="/feed" aria-label="HomieHouse feed"><HHLogo size={36} /></Link>
        <div>
          <h1 className="text-xl font-bold">Channels</h1>
          <p className="text-sm" style={{ color: 'var(--muted-on-dark)' }}>Find channels, save them to your list, and open their feeds.</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-24 lg:pb-8 grid grid-cols-1 lg:grid-cols-[240px_minmax(0,680px)] gap-6">
        <aside className="hidden lg:block"><SidebarNav /></aside>
        <main className="min-w-0">
          <label htmlFor="channel-search" className="block text-sm font-semibold mb-2">Search Hypersnap channels</label>
          <input
            id="channel-search"
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search by channel name or ID"
            className="w-full px-4 py-3 rounded-xl bg-transparent text-inherit"
            style={{ border: '1px solid var(--border)' }}
          />
          <p className="text-xs mt-2 mb-5" style={{ color: 'var(--muted-on-dark)' }}>Your saved channel list is stored on this device. Adding a channel here makes its feed easy to reach; posting still uses the channel’s Hypersnap parent URL.</p>

          {status && <p role="status" className="text-sm mb-4">{status}</p>}
          {error && <div role="alert" className="surface rounded-xl p-4 mb-4">{error}</div>}

          {saved.length > 0 && (
            <section aria-labelledby="my-channels-heading" className="mb-7">
              <h2 id="my-channels-heading" className="text-base font-bold mb-3">My Channels</h2>
              <div className="grid gap-2">
                {saved.map(channel => (
                  <ChannelRow key={channel.id} channel={channel} saved onToggle={() => toggleSaved(channel)} />
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="discover-channels-heading">
            <h2 id="discover-channels-heading" className="text-base font-bold mb-3">{query.trim() ? 'Search results' : 'Discover channels'}</h2>
            {(loading || searching) && <p role="status" className="py-6 text-sm" style={{ color: 'var(--muted-on-dark)' }}>{searching ? 'Searching channels…' : 'Loading channels…'}</p>}
            {!loading && !searching && results.length === 0 && !error && (
              <div className="surface rounded-xl p-5 text-sm" style={{ color: 'var(--muted-on-dark)' }}>
                {query.trim() ? 'No channels matched that search.' : 'No channels were returned. Try searching by a channel name.'}
              </div>
            )}
            {!loading && !searching && results.length > 0 && (
              <div className="grid gap-2">
                {results.map(channel => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    saved={savedIds.has(channel.id.toLowerCase())}
                    onToggle={() => toggleSaved(channel)}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function ChannelRow({ channel, saved, onToggle }: { channel: Channel; saved: boolean; onToggle: () => void }) {
  return (
    <article className="surface rounded-xl p-3 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <Link href={`/channel/${encodeURIComponent(channel.id)}`} className="font-semibold hover:underline">{displayName(channel)}</Link>
        <div className="text-xs mt-1" style={{ color: 'var(--muted-on-dark)' }}>/{channel.id}{channel.member_count != null ? ` · ${channel.member_count.toLocaleString()} members` : ''}</div>
        {channel.description && <p className="text-sm mt-2 line-clamp-2" style={{ color: 'var(--muted-on-dark)' }}>{channel.description}</p>}
      </div>
      <button type="button" onClick={onToggle} aria-pressed={saved} className="btn shrink-0 text-xs">
        {saved ? 'Added ✓' : '+ Add'}
      </button>
    </article>
  );
}
