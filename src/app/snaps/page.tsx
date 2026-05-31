"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SmartEmbed from "@/components/SmartEmbed";

interface SnapItem {
  url: string;
  name: string;
  addedAt: string;
}

const STORAGE_KEY = "hh_snaps";

export default function SnapsPage() {
  const [snaps, setSnaps] = useState<SnapItem[]>([]);
  const [inputUrl, setInputUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSnaps(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  function saveSnaps(updated: SnapItem[]) {
    setSnaps(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  function handleAdd() {
    setError(null);
    const trimmed = inputUrl.trim();
    if (!trimmed.startsWith("https://")) {
      setError("URL must start with https://");
      return;
    }
    const newSnap: SnapItem = {
      url: trimmed,
      name: trimmed,
      addedAt: new Date().toISOString(),
    };
    saveSnaps([newSnap, ...snaps]);
    setInputUrl("");
  }

  function handleRemove(index: number) {
    saveSnaps(snaps.filter((_, i) => i !== index));
  }

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100"
      style={{ padding: "0 16px 96px" }}
    >
      <div className="max-w-lg mx-auto pt-6">
        <div className="mb-5">
          <Link
            href="/"
            className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
          >
            ← Back
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6">Snaps</h1>

        {/* Add input */}
        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="https://..."
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={handleAdd}
              className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
          {error && (
            <p className="text-red-400 text-xs mt-2">{error}</p>
          )}
        </div>

        {/* Your Snaps */}
        <section className="mb-8">
          <h2 className="text-base font-semibold text-zinc-300 mb-3">
            Your Snaps
          </h2>
          {snaps.length === 0 ? (
            <p className="text-zinc-500 text-sm">
              No snaps saved yet. Paste a snap URL above to add one.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {snaps.map((item, index) => (
                <div key={`${item.url}-${item.addedAt}`} className="relative">
                  <button
                    onClick={() => handleRemove(index)}
                    className="absolute top-2 right-2 z-10 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
                    title="Remove"
                  >
                    ×
                  </button>
                  <SmartEmbed url={item.url} />
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-8 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
          <p className="text-sm text-zinc-400">
            Paste any Farcaster snap or frame URL above to add it to your collection.
            Find snaps by tapping embeds in casts.
          </p>
        </div>
      </div>
    </div>
  );
}
