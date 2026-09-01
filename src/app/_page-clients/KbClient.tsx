"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useFarcasterUser } from "@/hooks/useFarcasterUser";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────
interface SavedCast {
  id: string;
  cast_hash: string;
  cast_author_username?: string;
  cast_author_fid?: number;
  cast_text?: string;
  cast_timestamp?: string;
  saved_at: string;
  note?: string;
  note_id?: string;
  tags?: string[];
}

type FilterMode = "all" | "noted" | "recent";

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part)
      ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">{part}</mark>
      : part
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function KbClient() {
  const { user } = useFarcasterUser();
  const [casts, setCasts] = useState<SavedCast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const fid = user?.fid;

  const fetchCasts = useCallback(async () => {
    if (!fid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/saved-casts?fid=${fid}`);
      if (!res.ok) throw new Error("Failed to load saved casts");
      const data = await res.json();
      setCasts(data.casts || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [fid]);

  useEffect(() => { fetchCasts(); }, [fetchCasts]);

  // Focus note input when editing
  useEffect(() => {
    if (editingNote && noteRef.current) noteRef.current.focus();
  }, [editingNote]);

  async function saveNote(castId: string) {
    if (!fid) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/cast-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid, cast_id: castId, note: noteText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      setCasts(prev => prev.map(c =>
        c.id === castId ? { ...c, note: noteText.trim() } : c
      ));
      setEditingNote(null);
      setNoteText("");
    } catch {
      // fail silently — note persisted optimistically above
    } finally {
      setSavingNote(false);
    }
  }

  async function removeCast(castId: string, castHash: string) {
    if (!fid || !confirm("Remove this cast from your Knowledge Base?")) return;
    setRemovingId(castId);
    try {
      await fetch("/api/saved-casts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid, cast_hash: castHash }),
      });
      setCasts(prev => prev.filter(c => c.id !== castId));
    } catch {
      // ignore
    } finally {
      setRemovingId(null);
    }
  }

  function startEditNote(cast: SavedCast) {
    setEditingNote(cast.id);
    setNoteText(cast.note || "");
  }

  // ── Filter + search ──
  const visible = casts
    .filter(c => {
      if (filter === "noted") return !!c.note;
      if (filter === "recent") {
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return new Date(c.saved_at).getTime() > cutoff;
      }
      return true;
    })
    .filter(c => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.cast_text?.toLowerCase().includes(q) ||
        c.cast_author_username?.toLowerCase().includes(q) ||
        c.note?.toLowerCase().includes(q)
      );
    });

  // ── Not signed in ──
  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl">📚</div>
          <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
            Sign in to access your Knowledge Base
          </p>
          <Link href="/" className="inline-block text-sm text-zinc-400 hover:underline">
            ← Back to feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-black/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-bold flex items-center gap-2">📚 Knowledge Base</h1>
            <p className="text-xs text-zinc-400 truncate">
              {loading ? "Loading…" : `${casts.length} saved cast${casts.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {/* Search + filters */}
        <div className="max-w-2xl mx-auto px-4 pb-3 space-y-2">
          <input
            type="search"
            placeholder="Search saved casts, notes, authors…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 px-3 py-2 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          />
          <div className="flex gap-2">
            {(["all", "noted", "recent"] as FilterMode[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
                  filter === f
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-black"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {f === "all" ? `All (${casts.length})` : f === "noted" ? "With notes" : "This week"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-20">

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 space-y-2">
                <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/4" />
                <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-full" />
                <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-600 dark:text-red-400">
            ⚠️ {error}
            <button onClick={fetchCasts} className="ml-3 underline">Retry</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && casts.length === 0 && (
          <div className="text-center py-20 space-y-3">
            <div className="text-5xl">🔖</div>
            <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">No saved casts yet</p>
            <p className="text-sm text-zinc-400 max-w-xs mx-auto">
              Tap the bookmark icon on any cast in your feed to save it here.
            </p>
            <Link href="/" className="inline-block mt-4 px-5 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity">
              Browse Feed
            </Link>
          </div>
        )}

        {/* Search empty */}
        {!loading && !error && casts.length > 0 && visible.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm">No results for &quot;{search}&quot;</p>
            <button onClick={() => { setSearch(""); setFilter("all"); }} className="mt-3 text-xs text-zinc-400 hover:underline">
              Clear filters
            </button>
          </div>
        )}

        {/* Cast cards */}
        {!loading && !error && visible.map(cast => (
          <article
            key={cast.id}
            className={`group rounded-2xl bg-white dark:bg-zinc-900 border transition-all ${
              removingId === cast.id ? "opacity-40 scale-98" : "border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600"
            }`}
          >
            {/* Cast body */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                {cast.cast_author_username ? (
                  <Link
                    href={`/profile/${cast.cast_author_username}`}
                    className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:underline"
                  >
                    @{cast.cast_author_username}
                  </Link>
                ) : (
                  <span className="text-xs text-zinc-400 font-mono">{cast.cast_hash.slice(0, 12)}…</span>
                )}
                <span className="text-xs text-zinc-300 dark:text-zinc-600 shrink-0">
                  {timeAgo(cast.saved_at)}
                </span>
              </div>

              {cast.cast_text ? (
                <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
                  {highlight(cast.cast_text, search)}
                </p>
              ) : (
                <p className="text-sm text-zinc-400 font-mono">{cast.cast_hash}</p>
              )}
            </div>

            {/* Note section */}
            {editingNote === cast.id ? (
              <div className="px-4 pb-4 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <textarea
                  ref={noteRef}
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a note — why did you save this? What's the takeaway?"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
                  rows={3}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNote(cast.id);
                    if (e.key === "Escape") { setEditingNote(null); setNoteText(""); }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveNote(cast.id)}
                    disabled={savingNote}
                    className="px-3 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    {savingNote ? "Saving…" : "Save note ↵"}
                  </button>
                  <button
                    onClick={() => { setEditingNote(null); setNoteText(""); }}
                    className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : cast.note ? (
              <div
                className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800 pt-3 cursor-pointer"
                onClick={() => startEditNote(cast)}
              >
                <p className="text-xs text-zinc-400 mb-1">📝 Note</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 italic">
                  {highlight(cast.note, search)}
                </p>
              </div>
            ) : null}

            {/* Actions */}
            <div className="px-4 pb-3 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => startEditNote(cast)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                {cast.note ? "Edit note" : "＋ Add note"}
              </button>
              <Link
                href={`/cast/${cast.cast_hash}`}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                View cast →
              </Link>
              <button
                onClick={() => removeCast(cast.id, cast.cast_hash)}
                disabled={removingId === cast.id}
                className="ml-auto text-xs text-zinc-300 dark:text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </main>

      {/* Floating count badge */}
      {!loading && visible.length > 0 && (
        <div className="fixed bottom-6 right-6 bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-bold px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
          {visible.length} / {casts.length}
        </div>
      )}
    </div>
  );
}
