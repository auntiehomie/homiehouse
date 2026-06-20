"use client";

import { useState, useEffect } from "react";
import { useNeynarContext } from "@/hooks/useNeynarCompat";
import Link from "next/link";

interface CuratedItem {
  id: number;
  cast_hash: string;
  cast_text?: string;
  cast_author?: string;
  notes?: string;
  created_at: string;
}

interface CuratedList {
  id: number;
  list_name: string;
  description?: string;
  created_at: string;
  items?: CuratedItem[];
}

export default function KnowledgeBasePage() {
  const { user } = useNeynarContext();
  const [lists, setLists] = useState<CuratedList[]>([]);
  const [kbItems, setKbItems] = useState<CuratedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.fid) return;
    fetchKB();
  }, [user?.fid]);

  async function fetchKB() {
    setLoading(true);
    setError(null);
    try {
      const fid = user?.fid ?? 0;
      const res = await fetch(`/api/curated-lists?fid=${fid}`);
      if (!res.ok) throw new Error("Failed to load knowledge base");
      const data = await res.json();
      const allLists: CuratedList[] = data.lists || [];
      setLists(allLists);

      // Find the "knowledge-base" list
      const kbList = allLists.find(
        (l) => l.list_name === "knowledge-base" || l.list_name === "Knowledge Base"
      );

      if (kbList) {
        // Fetch items for the KB list
        const itemsRes = await fetch(
          `/api/curated-lists/${kbList.id}/items?fid=${fid}`
        );
        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          setKbItems(itemsData.items || []);
        }
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-center text-zinc-500">
          <p className="text-lg">Sign in to view your Knowledge Base</p>
          <Link href="/" className="mt-4 inline-block text-zinc-400 hover:text-white hover:underline">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-100 dark:text-zinc-100">
      <header className="max-w-3xl mx-auto px-4 sm:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span>📚</span> Knowledge Base
          </h1>
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your saved casts and bookmarks
        </p>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {loading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3 mb-2" />
                <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-zinc-400">
            {error}
          </div>
        )}

        {!loading && !error && kbItems.length === 0 && (
          <div className="text-center py-16 text-zinc-500 dark:text-zinc-400">
            <div className="text-5xl mb-4">🔖</div>
            <p className="text-lg font-medium mb-2">Your Knowledge Base is empty</p>
            <p className="text-sm">
              Save casts by tapping the bookmark icon on any cast in your feed.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Browse Feed
            </Link>
          </div>
        )}

        {!loading && !error && kbItems.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {kbItems.length} saved cast{kbItems.length !== 1 ? "s" : ""}
            </p>
            {kbItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                {item.cast_author && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                    @{item.cast_author}
                  </p>
                )}
                {item.cast_text ? (
                  <p className="text-sm leading-relaxed">{item.cast_text}</p>
                ) : (
                  <p className="text-sm text-zinc-400 font-mono">{item.cast_hash}</p>
                )}
                {item.notes && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-2">
                    📝 {item.notes}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                  <Link
                    href={`/cast/${item.cast_hash}`}
                    className="text-xs text-zinc-400 hover:text-white hover:underline"
                  >
                    View cast →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && lists.length > 0 && (
          <section className="mt-10">
            <h2 className="text-base font-semibold mb-3 text-zinc-700 dark:text-zinc-300">
              All Curated Lists
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4"
                >
                  <p className="font-medium text-sm">{list.list_name}</p>
                  {list.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{list.description}</p>
                  )}
                  <p className="text-xs text-zinc-400 mt-2">
                    Created {new Date(list.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

