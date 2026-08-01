"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Tab = 'people' | 'casts';

export default function SearchClient() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [tab, setTab] = useState<Tab>('people');
  const [people, setPeople] = useState<any[] | null>(null);
  const [casts, setCasts] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) { setQuery(q); runSearch(q); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async (q: string) => {
    if (!q.trim()) { setPeople(null); setCasts(null); return; }
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/users/search?q=${encodeURIComponent(q)}&limit=20`),
        fetch(`/api/casts/search?q=${encodeURIComponent(q)}&limit=20`),
      ]);
      const pData = await pRes.json();
      const cData = await cRes.json();
      setPeople(pData.users || []);
      setCasts(cData.casts || []);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') runSearch(query);
  };

  const tabCls = (t: Tab) =>
    `flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-white text-white'
        : 'border-transparent text-zinc-500 hover:text-zinc-300'
    }`;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 bg-black z-10 px-4 pt-4 pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Search people, casts..."
                className="w-full pl-9 pr-4 py-2 rounded-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-zinc-500"
              />
            </div>
            {query && (
              <button
                onClick={() => { setQuery(''); setPeople(null); setCasts(null); inputRef.current?.focus(); }}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Clear
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex">
            <button className={tabCls('people')} onClick={() => setTab('people')}>
              People {people !== null && `(${people.length})`}
            </button>
            <button className={tabCls('casts')} onClick={() => setTab('casts')}>
              Casts {casts !== null && `(${casts.length})`}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          {loading && (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-zinc-900 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {!loading && tab === 'people' && (
            <>
              {people === null && (
                <p className="text-zinc-500 text-sm text-center pt-12">Search for Farcaster users</p>
              )}
              {people?.length === 0 && <p className="text-zinc-500 text-sm">No people found</p>}
              {people && people.length > 0 && (
                <div className="space-y-2">
                  {people.map((u: any) => (
                    <Link
                      key={u.fid || u.username}
                      href={`/profile?user=${u.username || ''}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors"
                    >
                      <img
                        src={u.pfp_url || ''}
                        alt={u.username}
                        className="w-10 h-10 rounded-full object-cover bg-zinc-700"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{u.display_name || u.username}</div>
                        <div className="text-sm text-zinc-400">@{u.username}</div>
                      </div>
                      {u.follower_count != null && (
                        <div className="ml-auto text-xs text-zinc-500 shrink-0">
                          {u.follower_count.toLocaleString()} followers
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && tab === 'casts' && (
            <>
              {casts === null && (
                <p className="text-zinc-500 text-sm text-center pt-12">Search for casts</p>
              )}
              {casts?.length === 0 && <p className="text-zinc-500 text-sm">No casts found</p>}
              {casts && casts.length > 0 && (
                <div className="space-y-3">
                  {casts.map((c: any) => {
                    const author = c.author || {};
                    return (
                      <div key={c.hash} className="p-3 rounded-xl bg-zinc-900">
                        <div className="flex items-center gap-2 mb-2">
                          <img
                            src={author.pfp_url || ''}
                            alt={author.username}
                            className="w-8 h-8 rounded-full object-cover bg-zinc-700"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <Link href={`/profile?user=${author.username || ''}`} className="font-medium text-white text-sm hover:underline">
                            {author.display_name || author.username}
                          </Link>
                          <span className="text-zinc-500 text-xs">@{author.username}</span>
                        </div>
                        <p className="text-sm text-zinc-200 leading-relaxed line-clamp-4">{c.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
