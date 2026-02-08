"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSearch = async (q: string) => {
    if (!q) return setResults(null);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&limit=20`);
      const data = await res.json();
      setResults(data.users || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Search profiles</h1>
        <div className="mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(query); }}
            placeholder="Search username or display name"
            className="w-full p-3 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
          />
          <div className="flex gap-2 mt-2">
            <button onClick={() => doSearch(query)} className="px-4 py-2 bg-orange-600 text-white rounded">Search</button>
            <button onClick={() => { setQuery(''); setResults(null); }} className="px-4 py-2 border rounded">Clear</button>
          </div>
        </div>

        {loading && <div className="text-gray-600 dark:text-gray-400">Searching…</div>}
        {error && <div className="text-red-600">{error}</div>}

        {results && (
          <div className="space-y-3">
            {results.length === 0 && <div className="text-gray-600 dark:text-gray-400">No results</div>}
            {results.map((u: any) => (
              <Link key={u.username || u.fid} href={`/profile?user=${u.username || ''}`} className="block p-3 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <div className="flex items-center gap-3">
                  <img src={u.pfp_url || ''} alt={u.username} className="w-12 h-12 rounded-full" />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{u.display_name || u.username}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">@{u.username}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
