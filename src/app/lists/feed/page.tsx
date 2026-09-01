"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFarcasterUser } from "@/hooks/useFarcasterUser";

interface Curator {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
}

interface FeedItem {
  id: number;
  list_id: number;
  list_name: string;
  curator_fid: number;
  curator: Curator;
  cast_hash: string;
  cast_text: string | null;
  cast_author_fid: number | null;
  cast_timestamp: string | null;
  notes: string | null;
  created_at: string;
  feed_timestamp: string;
}

const PAGE_SIZE = 20;

export default function UnifiedListFeedPage() {
  const { user } = useFarcasterUser();
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (cursor?: string) => {
    if (!user?.fid) return;

    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        fid: String(user.fid),
        limit: String(PAGE_SIZE),
      });
      if (cursor) params.set("cursor", cursor);

      const response = await fetch(`/api/curated-lists/feed?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load followed-list feed");

      const incoming: FeedItem[] = data.items || [];
      setItems((current) => cursor ? [...current, ...incoming] : incoming);
      setNextCursor(data.nextCursor || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load followed-list feed");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user?.fid]);

  useEffect(() => {
    if (!user?.fid) {
      setItems([]);
      setNextCursor(null);
      return;
    }

    void loadPage();
  }, [loadPage, user?.fid]);

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-3 flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Go back"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">Following Feed</h1>
              <p className="mt-1 text-sm text-zinc-500">Newest casts from every public list you follow.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/lists"
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white"
            >
              Manage lists
            </Link>
            <Link
              href="/lists/feed"
              aria-current="page"
              className="rounded-full border border-emerald-500 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400"
            >
              Following Feed
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {!user?.fid ? (
          <div className="rounded-xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
            <div className="mb-3 text-4xl">📜</div>
            <h2 className="mb-2 text-lg font-semibold">Sign in to build your feed</h2>
            <p className="text-sm text-zinc-500">Follow public curated lists, then their newest casts will appear here.</p>
          </div>
        ) : loading ? (
          <div className="space-y-4" aria-label="Loading followed-list feed">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-32 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
            ))}
          </div>
        ) : error && items.length === 0 ? (
          <div className="rounded-xl border border-red-200 p-8 text-center dark:border-red-900">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              type="button"
              onClick={() => void loadPage()}
              className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
            <div className="mb-3 text-4xl">🗂️</div>
            <h2 className="mb-2 text-lg font-semibold">Your feed is ready for some lists</h2>
            <p className="mb-5 text-sm text-zinc-500">Follow a public list and its saved casts will show up here automatically.</p>
            <Link href="/lists" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-black">
              Discover public lists
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {items.map((item) => (
                <article key={item.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-3 flex items-center gap-3">
                    {item.curator.pfp_url ? (
                      <img src={item.curator.pfp_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">L</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.list_name}</p>
                      <p className="truncate text-xs text-zinc-500">
                        Curated by {item.curator.username ? `@${item.curator.username}` : `FID ${item.curator_fid}`}
                      </p>
                    </div>
                    <time className="text-xs text-zinc-500" dateTime={item.feed_timestamp}>
                      {new Date(item.feed_timestamp).toLocaleDateString()}
                    </time>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                    {item.cast_text || "This saved cast has no text preview."}
                  </p>

                  {item.notes && (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                      <span className="font-semibold">Curator note:</span> {item.notes}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-4 text-xs">
                    <span className="text-zinc-500">
                      {item.cast_author_fid ? `Cast author FID ${item.cast_author_fid}` : "Saved Farcaster cast"}
                    </span>
                    <Link
                      href={`https://warpcast.com/~/conversations/${item.cast_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      View cast →
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            {error && <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

            {nextCursor && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => void loadPage(nextCursor)}
                  disabled={loadingMore}
                  className="rounded-lg border border-zinc-300 px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
