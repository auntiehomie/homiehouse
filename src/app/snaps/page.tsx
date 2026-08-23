"use client";

import { useState, useEffect, useCallback } from "react";
import { useFarcasterAuth } from "@/lib/farcaster-auth";

interface AppEntry {
  id: string;
  name: string;
  description: string;
  icon: string;       // emoji fallback
  iconUrl?: string;   // real icon image
  imageUrl?: string;  // hero image for featured cards
  tags: string[];
  author: string;
  url: string;
  likes?: number;
  comments?: number;
  featuredBg?: string;
  category?: string;
}

const STORAGE_KEY = "hh_saved_apps";
const STORAGE_APPS_KEY = "hh_saved_apps_data";

type Tab = "trending" | "new" | "yours";

// ─── Skeleton placeholder data shown while loading ───────────────────────────
const SKELETON_APPS: AppEntry[] = Array.from({ length: 8 }, (_, i) => ({
  id: `skeleton-${i}`,
  name: '',
  description: '',
  icon: '',
  tags: [],
  author: '',
  url: '',
}));

export default function AppsPage() {
  const { fid: userFid } = useFarcasterAuth();

  const [activeTab, setActiveTab] = useState<Tab>("trending");
  const [trendingApps, setTrendingApps] = useState<AppEntry[]>([]);
  const [newApps, setNewApps] = useState<AppEntry[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedApps, setSavedApps] = useState<AppEntry[]>([]);
  const [openApp, setOpenApp] = useState<AppEntry | null>(null);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingNew, setLoadingNew] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [trendingCursor, setTrendingCursor] = useState<string | null>(null);
  const [newCursor, setNewCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Load saved app data — merge DB (if logged in) with localStorage
  useEffect(() => {
    async function loadSaved() {
      // Read localStorage first
      let localApps: AppEntry[] = [];
      try {
        const storedData = localStorage.getItem(STORAGE_APPS_KEY);
        if (storedData) {
          const parsed: Record<string, AppEntry> = JSON.parse(storedData);
          localApps = Object.values(parsed);
        } else {
          // Migrate old format (IDs only)
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              const ids = parsed.map((x: any) => typeof x === "string" ? x : (x.id || x.url));
              setSavedIds(new Set(ids));
            }
          }
        }
      } catch {}

      if (userFid) {
        try {
          const res = await fetch(`/api/saved-apps?fid=${userFid}`);
          const data = await res.json();
          const dbApps: AppEntry[] = data.apps ?? [];
          // Merge: db takes precedence, then add any local-only apps
          const dbIds = new Set(dbApps.map((a: AppEntry) => a.id));
          const localOnly = localApps.filter(a => !dbIds.has(a.id));
          // Upload local-only apps to DB so they sync
          for (const app of localOnly) {
            fetch('/api/saved-apps', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fid: userFid, app }),
            }).catch(() => {});
          }
          const merged = [...dbApps, ...localOnly];
          setSavedApps(merged);
          setSavedIds(new Set(merged.map(a => a.id)));
          // Update localStorage to match merged state
          const map: Record<string, AppEntry> = {};
          merged.forEach(a => { map[a.id] = a; });
          try {
            localStorage.setItem(STORAGE_APPS_KEY, JSON.stringify(map));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged.map(a => a.id)));
          } catch {}
          return;
        } catch {}
      }

      // Fallback: just use localStorage
      if (localApps.length > 0) {
        setSavedApps(localApps);
        setSavedIds(new Set(localApps.map(a => a.id)));
      }
    }
    loadSaved();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFid]);

  async function persistApps(apps: AppEntry[], changedApp?: AppEntry, removed?: boolean) {
    const map: Record<string, AppEntry> = {};
    apps.forEach(a => { map[a.id] = a; });
    setSavedApps(apps);
    setSavedIds(new Set(apps.map(a => a.id)));
    // Update localStorage as fallback
    try {
      localStorage.setItem(STORAGE_APPS_KEY, JSON.stringify(map));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(apps.map(a => a.id)));
    } catch {}
    // Sync to DB if logged in
    if (userFid && changedApp) {
      try {
        if (removed) {
          await fetch('/api/saved-apps', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fid: userFid, appId: changedApp.id }),
          });
        } else {
          await fetch('/api/saved-apps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fid: userFid, app: changedApp }),
          });
        }
      } catch {}
    }
  }

  // Once allApps loads, backfill any legacy saved IDs that have no full data yet
  const allApps = [...trendingApps, ...newApps.filter(a => !trendingApps.some(t => t.id === a.id))];
  useEffect(() => {
    if (allApps.length === 0) return;
    const storedData = localStorage.getItem(STORAGE_APPS_KEY);
    if (storedData) return; // already migrated
    // Migrate: find full objects for any legacy IDs
    if (savedIds.size === 0) return;
    const migrated = allApps.filter(a => savedIds.has(a.id));
    if (migrated.length > 0) persistApps(migrated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allApps.length]);

  const isSaved = (app: AppEntry) => savedIds.has(app.id);

  // Fetch trending apps
  useEffect(() => {
    setLoadingTrending(true);
    fetch('/api/mini-apps?time_window=7d&limit=50')
      .then(r => r.json())
      .then(data => {
        setTrendingApps(data.apps || []);
        setTrendingCursor(data.cursor || null);
      })
      .catch(() => {})
      .finally(() => setLoadingTrending(false));
  }, []);

  // Fetch new apps (shorter window = more recent activity)
  useEffect(() => {
    setLoadingNew(true);
    fetch('/api/mini-apps?time_window=24h&limit=50')
      .then(r => r.json())
      .then(data => {
        setNewApps(data.apps || []);
        setNewCursor(data.cursor || null);
      })
      .catch(() => {})
      .finally(() => setLoadingNew(false));
  }, []);

  const loadMoreTrending = useCallback(async () => {
    if (!trendingCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetch(`/api/mini-apps?time_window=7d&limit=50&cursor=${encodeURIComponent(trendingCursor)}`).then(r => r.json());
      setTrendingApps(prev => [...prev, ...(data.apps || [])]);
      setTrendingCursor(data.cursor || null);
    } catch {}
    setLoadingMore(false);
  }, [trendingCursor, loadingMore]);

  const loadMoreNew = useCallback(async () => {
    if (!newCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetch(`/api/mini-apps?time_window=24h&limit=50&cursor=${encodeURIComponent(newCursor)}`).then(r => r.json());
      setNewApps(prev => [...prev, ...(data.apps || [])]);
      setNewCursor(data.cursor || null);
    } catch {}
    setLoadingMore(false);
  }, [newCursor, loadingMore]);

  const searchResults = searchQuery.trim().length > 1
    ? allApps.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : null;

  const myApps = savedApps;

  // Featured = top 4 from trending with an imageUrl
  const featured = trendingApps.slice(0, 6);

  const tabApps = activeTab === "trending" ? trendingApps
    : activeTab === "new" ? newApps
    : myApps;

  const isLoading = activeTab === "trending" ? loadingTrending
    : activeTab === "new" ? loadingNew
    : false;

  return (
    <div className="min-h-screen bg-black text-white" style={{ paddingBottom: 96 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", borderBottom: "1px solid #222" }}>
        <div style={{ width: 32 }} />
        <span style={{ fontSize: 17, fontWeight: 600 }}>Apps</span>
        <button
          onClick={() => { setShowSearch(!showSearch); setSearchQuery(""); }}
          style={{ background: "transparent", border: "none", color: "#aaa", cursor: "pointer", padding: 4 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div style={{ padding: "8px 16px", borderBottom: "1px solid #222" }}>
          <input
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search apps…"
            style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 14, outline: "none" }}
          />
        </div>
      )}

      {searchResults !== null ? (
        <div style={{ padding: "8px 0" }}>
          {searchResults.length === 0
            ? <p style={{ textAlign: "center", color: "#666", padding: "32px 0", fontSize: 14 }}>No apps found</p>
            : searchResults.map(app => <AppRow key={app.id} app={app} saved={isSaved(app)} onOpen={() => setOpenApp(app)} />)
          }
        </div>
      ) : (
        <>
          {/* Discover / Featured carousel */}
          {!loadingTrending && featured.length > 0 && (
            <div style={{ padding: "16px 0 8px" }}>
              <div style={{ paddingLeft: 16, marginBottom: 10, fontSize: 18, fontWeight: 700 }}>Discover</div>
              <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px 4px", scrollbarWidth: "none" }}>
                {featured.map(app => (
                  <FeaturedCard key={app.id} app={app} saved={isSaved(app)} onOpen={() => setOpenApp(app)} />
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #222", padding: "0 16px", gap: 24 }}>
            {([["trending", "Trending"], ["new", "New"], ["yours", "Your Apps"]] as [Tab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: "transparent", border: "none",
                  color: activeTab === tab ? "#fff" : "#666",
                  fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
                  padding: "12px 0", cursor: "pointer",
                  borderBottom: activeTab === tab ? "2px solid #fff" : "2px solid transparent",
                  marginBottom: -1, transition: "color 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* App list */}
          <div>
            {activeTab === "yours" && myApps.length === 0 ? (
              <p style={{ textAlign: "center", color: "#555", padding: "40px 16px", fontSize: 14 }}>
                No apps added yet. Browse Trending or New and tap "Add Mini App".
              </p>
            ) : isLoading ? (
              SKELETON_APPS.map((_, i) => <AppRowSkeleton key={i} />)
            ) : (
              <>
                {tabApps.map(app => (
                  <AppRow key={app.id} app={app} saved={isSaved(app)} onOpen={() => setOpenApp(app)} />
                ))}
                {/* Load more */}
                {(activeTab === "trending" && trendingCursor) || (activeTab === "new" && newCursor) ? (
                  <button
                    onClick={activeTab === "trending" ? loadMoreTrending : loadMoreNew}
                    disabled={loadingMore}
                    style={{
                      display: "block", width: "calc(100% - 32px)", margin: "16px 16px",
                      padding: "12px", background: "#111", border: "1px solid #222",
                      borderRadius: 12, color: "#888", fontSize: 14, cursor: "pointer",
                    }}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </>
      )}

      {/* App detail sheet */}
      {openApp && (
        <div
          onClick={() => setOpenApp(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#111", borderRadius: "20px 20px 0 0", maxHeight: "90vh", overflow: "auto", paddingBottom: "calc(32px + env(safe-area-inset-bottom))" }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#333" }} />
            </div>

            {/* Hero image if available */}
            {openApp.imageUrl && (
              <div style={{ width: "100%", aspectRatio: "3/2", overflow: "hidden", background: "#1a1a1a" }}>
                <img src={openApp.imageUrl} alt={openApp.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}

            {/* App header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 16px 12px" }}>
              <AppIcon app={openApp} size={56} radius={14} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{openApp.name}</div>
                <div style={{ fontSize: 13, color: "#888", marginTop: 3, lineHeight: 1.4 }}>{openApp.description}</div>
                {openApp.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {openApp.tags.map(t => (
                      <span key={t} style={{ background: "#1c1c1e", border: "1px solid #333", borderRadius: 20, padding: "2px 8px", fontSize: 11, color: "#aaa" }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setOpenApp(null)} style={{ background: "#222", border: "none", borderRadius: "50%", width: 32, height: 32, color: "#aaa", cursor: "pointer", fontSize: 18, flexShrink: 0 }}>×</button>
            </div>

            <div style={{ padding: "0 16px" }}>
              {openApp.author && (
                <div style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>by @{openApp.author}</div>
              )}

              {/* Open App */}
              <a
                href={openApp.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "15px", background: "#fff", color: "#000", borderRadius: 14, fontSize: 15, fontWeight: 600, textDecoration: "none", marginBottom: 12 }}
              >
                Open App
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
              </a>

              {/* Add / Remove Mini App */}
              {isSaved(openApp) ? (
                <button
                  onClick={() => persistApps(savedApps.filter(a => a.id !== openApp.id), openApp, true)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "14px", background: "transparent", border: "1px solid #333", borderRadius: 14, fontSize: 15, color: "#ef4444", fontWeight: 500, cursor: "pointer" }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                  Remove Mini App
                </button>
              ) : (
                <button
                  onClick={() => persistApps([...savedApps, openApp], openApp, false)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "14px", background: "transparent", border: "1px solid #444", borderRadius: 14, fontSize: 15, color: "#aaa", fontWeight: 500, cursor: "pointer" }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                  Add Mini App
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AppIcon({ app, size = 52, radius = 12 }: { app: AppEntry; size?: number; radius?: number }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.46, flexShrink: 0, overflow: "hidden" }}>
      {app.iconUrl && !imgError
        ? <img src={app.iconUrl} alt={app.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgError(true)} />
        : <span>{app.icon || '🔗'}</span>
      }
    </div>
  );
}

function FeaturedCard({ app, saved, onOpen }: { app: AppEntry; saved?: boolean; onOpen: () => void }) {
  const [imgError, setImgError] = useState(false);
  const hasHero = app.imageUrl && !imgError;

  return (
    <button
      onClick={onOpen}
      style={{ flexShrink: 0, width: 260, height: 150, borderRadius: 16, overflow: "hidden", position: "relative", background: app.featuredBg || "#1c1c1e", border: "none", cursor: "pointer", textAlign: "left" }}
    >
      {hasHero && (
        <img src={app.imageUrl} alt={app.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgError(true)} />
      )}
      {/* gradient overlay */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)" }} />
      {!hasHero && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-60%)", fontSize: 56, fontWeight: 900, color: "rgba(255,255,255,0.06)", whiteSpace: "nowrap", userSelect: "none" }}>
          {app.name.toUpperCase()}
        </div>
      )}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <AppIcon app={app} size={38} radius={9} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", lineHeight: 1.2 }}>{app.name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>{app.description}</div>
        </div>
      </div>
    </button>
  );
}

function AppRow({ app, saved, onOpen }: { app: AppEntry; saved?: boolean; onOpen: () => void }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #111", cursor: "pointer" }}
      onClick={onOpen}
    >
      <AppIcon app={app} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: "#fff", marginBottom: 2 }}>{app.name}</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.description}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {app.tags.map(tag => (
            <span key={tag} style={{ background: "#1c1c1e", border: "1px solid #333", borderRadius: 20, padding: "2px 8px", fontSize: 11, color: "#aaa" }}>{tag}</span>
          ))}
          {app.author && <span style={{ fontSize: 11, color: "#555" }}>by @{app.author}</span>}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        {saved && (
          <span style={{ fontSize: 10, color: "#555", background: "#1c1c1e", border: "1px solid #2a2a2a", borderRadius: 6, padding: "2px 6px" }}>Added</span>
        )}
      </div>
    </div>
  );
}

function AppRowSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #111" }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: "#1c1c1e" }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: "40%", height: 14, background: "#1c1c1e", borderRadius: 4, marginBottom: 8 }} />
        <div style={{ width: "70%", height: 11, background: "#161616", borderRadius: 4, marginBottom: 8 }} />
        <div style={{ width: "30%", height: 11, background: "#161616", borderRadius: 4 }} />
      </div>
    </div>
  );
}
