"use client";

import { useState, useEffect } from "react";
import SmartEmbed from "@/components/SmartEmbed";

interface AppEntry {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  author: string;
  authorPfp?: string;
  url: string;
  likes?: number;
  comments?: number;
  featuredBg?: string;
  /** true = snap/frame URL — use SmartEmbed; false = regular website — show info sheet */
  isEmbed?: boolean;
}

interface SavedApp {
  url: string;
  name: string;
  addedAt: string;
}

const STORAGE_KEY = "hh_snaps";

const FEATURED: AppEntry[] = [
  {
    id: "zora",
    name: "Zora",
    description: "Mint NFTs directly from your feed",
    icon: "🎨",
    tags: ["NFT", "Mint"],
    author: "zora",
    url: "https://zora.co",
    likes: 540,
    comments: 61,
    featuredBg: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  },
  {
    id: "supercast",
    name: "Supercast",
    description: "Power tools for Farcaster power users",
    icon: "⚡",
    tags: ["Productivity", "Tools"],
    author: "supercast",
    url: "https://supercast.xyz",
    likes: 411,
    comments: 57,
    featuredBg: "linear-gradient(135deg, #1a1a1a 0%, #2d1b00 50%, #1a0a00 100%)",
  },
  {
    id: "paragraph",
    name: "Paragraph",
    description: "Read and collect articles from your favorite writers",
    icon: "📄",
    tags: ["Writing", "Collect"],
    author: "paragraph",
    url: "https://paragraph.xyz",
    likes: 312,
    comments: 28,
    featuredBg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  },
  {
    id: "clanker",
    name: "Clanker",
    description: "Launch tokens from a cast in seconds",
    icon: "🤖",
    tags: ["Tokens", "DeFi"],
    author: "clanker",
    url: "https://clanker.world",
    likes: 623,
    comments: 74,
    featuredBg: "linear-gradient(135deg, #001a00 0%, #003300 50%, #004d00 100%)",
  },
];

const NEW_APPS: AppEntry[] = [
  {
    id: "jam",
    name: "Jam",
    description: "Create and share music with the Farcaster community",
    icon: "🎵",
    tags: ["Music", "Social"],
    author: "jamxyz",
    url: "https://jam.so",
    likes: 94,
    comments: 12,
  },
  {
    id: "launchcaster",
    name: "Launchcaster",
    description: "Discover the best new projects in web3",
    icon: "🚀",
    tags: ["Discovery", "Web3"],
    author: "launchcaster",
    url: "https://launchcaster.xyz",
    likes: 203,
    comments: 31,
  },
  {
    id: "bountycaster",
    name: "Bountycaster",
    description: "Post and claim bounties from the community",
    icon: "💰",
    tags: ["Bounties", "Work"],
    author: "bountycaster",
    url: "https://bountycaster.xyz",
    likes: 176,
    comments: 24,
  },
  {
    id: "pods",
    name: "Pods",
    description: "Listen to podcasts with your Farcaster community",
    icon: "🎙️",
    tags: ["Audio", "Social"],
    author: "pods",
    url: "https://pods.media",
    likes: 189,
    comments: 14,
  },
  {
    id: "gallery",
    name: "Gallery",
    description: "Showcase and collect NFT art from the community",
    icon: "🖼️",
    tags: ["NFT", "Art"],
    author: "gallery",
    url: "https://gallery.so",
    likes: 258,
    comments: 33,
  },
  {
    id: "wildcard",
    name: "Wildcard",
    description: "Farcaster mini-games and social experiences",
    icon: "🃏",
    tags: ["Game", "Social"],
    author: "wildcard",
    url: "https://wildcard.lol",
    likes: 131,
    comments: 18,
  },
  {
    id: "hypersub",
    name: "Hypersub",
    description: "Token-gated subscriptions for your community",
    icon: "🔐",
    tags: ["Subscriptions", "Token"],
    author: "hypersub",
    url: "https://hypersub.xyz",
    likes: 220,
    comments: 29,
  },
  {
    id: "alfafrens",
    name: "Alfafrens",
    description: "Subscribe to alpha channels and earn rewards",
    icon: "💎",
    tags: ["Alpha", "Social"],
    author: "alfafrens",
    url: "https://alfafrens.com",
    likes: 445,
    comments: 52,
  },
];

const TRENDING_APPS: AppEntry[] = [
  {
    id: "warpcast",
    name: "Warpcast",
    description: "The flagship Farcaster client by the Farcaster team",
    icon: "🟣",
    tags: ["Client", "Social"],
    author: "farcaster",
    url: "https://warpcast.com",
    likes: 1204,
    comments: 88,
  },
  {
    id: "neynar",
    name: "Neynar Explorer",
    description: "Explore Farcaster data and analytics",
    icon: "📊",
    tags: ["Analytics", "Data"],
    author: "neynar",
    url: "https://explorer.neynar.com",
    likes: 387,
    comments: 43,
  },
  {
    id: "openrank",
    name: "OpenRank",
    description: "Trustworthy rankings for the open social web",
    icon: "🏆",
    tags: ["Rankings", "Trust"],
    author: "openrank",
    url: "https://openrank.com",
    likes: 298,
    comments: 35,
  },
  {
    id: "quorum",
    name: "Quorum",
    description: "Decentralized social built on Farcaster & Quilibrium",
    icon: "🌐",
    tags: ["Client", "Privacy"],
    author: "quorum",
    url: "https://quilibrium.com",
    likes: 512,
    comments: 64,
  },
  {
    id: "farquest",
    name: "Farquest",
    description: "Explore the Farcaster social graph visually",
    icon: "🗺️",
    tags: ["Graph", "Explorer"],
    author: "farquest",
    url: "https://farquest.xyz",
    likes: 142,
    comments: 19,
  },
  {
    id: "farpay",
    name: "Farpay",
    description: "Send payments directly from your casts",
    icon: "💸",
    tags: ["Payments", "Web3"],
    author: "farpay",
    url: "https://farpay.io",
    likes: 189,
    comments: 22,
  },
  {
    id: "daylight",
    name: "Daylight",
    description: "Discover token-gated opportunities for your wallet",
    icon: "☀️",
    tags: ["NFT", "Tokens"],
    author: "daylight",
    url: "https://daylight.xyz",
    likes: 234,
    comments: 27,
  },
  {
    id: "ponder",
    name: "Ponder",
    description: "On-chain polls and social predictions",
    icon: "🤔",
    tags: ["Polls", "Social"],
    author: "ponder",
    url: "https://warpcast.com/~/channel/ponder",
    likes: 167,
    comments: 21,
  },
];

type Tab = "new" | "trending" | "yours";

const ALL_CURATED = [...FEATURED, ...NEW_APPS, ...TRENDING_APPS];

export default function AppsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("new");
  // savedIds: set of app IDs the user has added to My Apps
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [openApp, setOpenApp] = useState<AppEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Support old SavedApp[] format or new string[] format
        if (Array.isArray(parsed)) {
          const ids = parsed.map((x: any) => typeof x === "string" ? x : x.id || x.url);
          setSavedIds(new Set(ids));
        }
      }
    } catch {}
  }, []);

  function persistIds(ids: Set<string>) {
    setSavedIds(ids);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids])); } catch {}
  }

  function addApp(app: AppEntry) {
    const next = new Set(savedIds);
    next.add(app.id);
    persistIds(next);
  }

  function removeApp(app: AppEntry) {
    const next = new Set(savedIds);
    next.delete(app.id);
    persistIds(next);
  }

  const isSaved = (app: AppEntry) => savedIds.has(app.id);

  const searchResults = searchQuery.trim().length > 1
    ? ALL_CURATED.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : null;

  const myApps = ALL_CURATED.filter(a => savedIds.has(a.id));

  const tabApps: AppEntry[] =
    activeTab === "new" ? NEW_APPS :
    activeTab === "trending" ? TRENDING_APPS :
    myApps;

  return (
    <div className="min-h-screen bg-black text-white" style={{ paddingBottom: 96 }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 16px 12px",
        borderBottom: "1px solid #222",
      }}>
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
            style={{
              width: "100%",
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 10,
              padding: "8px 12px",
              color: "#fff",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>
      )}

      {/* Search results */}
      {searchResults !== null ? (
        <div style={{ padding: "8px 0" }}>
          {searchResults.length === 0 ? (
            <p style={{ textAlign: "center", color: "#666", padding: "32px 0", fontSize: 14 }}>No apps found</p>
          ) : (
            searchResults.map(app => (
              <AppRow key={app.id} app={app} onOpen={() => setOpenApp(app)} />
            ))
          )}
        </div>
      ) : (
        <>
          {/* Discover / Featured */}
          <div style={{ padding: "16px 0 8px" }}>
            <div style={{ paddingLeft: 16, marginBottom: 10, fontSize: 18, fontWeight: 700 }}>Discover</div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px 4px", scrollbarWidth: "none" }}>
              {FEATURED.map(app => (
                <button
                  key={app.id}
                  onClick={() => setOpenApp(app)}
                  style={{
                    flexShrink: 0,
                    width: 280,
                    height: 160,
                    borderRadius: 16,
                    overflow: "hidden",
                    position: "relative",
                    background: app.featuredBg || "#222",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "12px",
                    background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      flexShrink: 0,
                    }}>
                      {app.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{app.name}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>{app.description}</div>
                    </div>
                  </div>
                  {/* Decorative background text */}
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -60%)",
                    fontSize: 64,
                    fontWeight: 900,
                    color: "rgba(255,255,255,0.08)",
                    whiteSpace: "nowrap",
                    letterSpacing: 2,
                    userSelect: "none",
                  }}>
                    {app.name.toUpperCase()}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex",
            borderBottom: "1px solid #222",
            padding: "0 16px",
            gap: 24,
          }}>
            {([["new", "New"], ["trending", "Trending"], ["yours", "Your Apps"]] as [Tab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: activeTab === tab ? "#fff" : "#666",
                  fontSize: 14,
                  fontWeight: activeTab === tab ? 600 : 400,
                  padding: "12px 0",
                  cursor: "pointer",
                  borderBottom: activeTab === tab ? "2px solid #fff" : "2px solid transparent",
                  marginBottom: -1,
                  transition: "color 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* App list */}
          <div>
            {tabApps.length === 0 && activeTab === "yours" ? (
              <p style={{ textAlign: "center", color: "#555", padding: "40px 16px", fontSize: 14 }}>
                No apps added yet. Tap any app and choose "Add Mini App".
              </p>
            ) : (
              tabApps.map(app => (
                <AppRow
                  key={app.id}
                  app={app}
                  saved={isSaved(app)}
                  onOpen={() => setOpenApp(app)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* App viewer modal */}
      {openApp && (
        <div
          onClick={() => setOpenApp(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#111",
              borderRadius: "20px 20px 0 0",
              maxHeight: "90vh",
              overflow: "auto",
              paddingBottom: "calc(32px + env(safe-area-inset-bottom))",
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#333" }} />
            </div>

            {/* Sheet header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "12px 16px 16px",
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "#1c1c1e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                flexShrink: 0,
              }}>
                {openApp.icon}
              </div>
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
              <button
                onClick={() => setOpenApp(null)}
                style={{ background: "#222", border: "none", borderRadius: "50%", width: 32, height: 32, color: "#aaa", cursor: "pointer", fontSize: 18, flexShrink: 0 }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "0 16px" }}>
              {/* Stats row */}
              {(openApp.likes !== undefined || openApp.comments !== undefined) && (
                <div style={{ display: "flex", gap: 16, marginBottom: 16, color: "#666", fontSize: 13 }}>
                  {openApp.likes !== undefined && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                      {openApp.likes}
                    </span>
                  )}
                  {openApp.comments !== undefined && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      {openApp.comments}
                    </span>
                  )}
                  {openApp.author && <span>by @{openApp.author}</span>}
                </div>
              )}

              {/* Open App */}
              <a
                href={openApp.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  width: "100%", padding: "15px", background: "#fff", color: "#000",
                  borderRadius: 14, fontSize: 15, fontWeight: 600, textDecoration: "none",
                  marginBottom: 12,
                }}
              >
                Open App
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
              </a>

              {/* Add / Remove Mini App */}
              {isSaved(openApp) ? (
                <button
                  onClick={() => { removeApp(openApp); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    width: "100%", padding: "14px", background: "transparent",
                    border: "1px solid #333", borderRadius: 14, fontSize: 15,
                    color: "#ef4444", fontWeight: 500, cursor: "pointer",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                  Remove Mini App
                </button>
              ) : (
                <button
                  onClick={() => { addApp(openApp); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    width: "100%", padding: "14px", background: "transparent",
                    border: "1px solid #444", borderRadius: 14, fontSize: 15,
                    color: "#aaa", fontWeight: 500, cursor: "pointer",
                  }}
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

function AppRow({ app, saved, onOpen }: { app: AppEntry; saved?: boolean; onOpen: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid #111",
        cursor: "pointer",
      }}
      onClick={onOpen}
    >
      {/* Icon */}
      <div style={{
        width: 52,
        height: 52,
        borderRadius: 12,
        background: "#1c1c1e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        flexShrink: 0,
      }}>
        {app.icon}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: "#fff", marginBottom: 2 }}>{app.name}</div>
        <div style={{
          fontSize: 13,
          color: "#888",
          marginBottom: 6,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {app.description}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {app.tags.map(tag => (
            <span key={tag} style={{
              background: "#1c1c1e",
              border: "1px solid #333",
              borderRadius: 20,
              padding: "2px 8px",
              fontSize: 11,
              color: "#aaa",
            }}>
              {tag}
            </span>
          ))}
          {app.author && (
            <span style={{ fontSize: 11, color: "#555" }}>by @{app.author}</span>
          )}
        </div>
      </div>

      {/* Counts + remove */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        {app.likes !== undefined && (
          <span style={{ fontSize: 12, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {app.likes}
          </span>
        )}
        {app.comments !== undefined && (
          <span style={{ fontSize: 12, color: "#555", display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {app.comments}
          </span>
        )}
        {saved && (
          <span style={{ fontSize: 10, color: "#555", background: "#1c1c1e", border: "1px solid #2a2a2a", borderRadius: 6, padding: "2px 6px" }}>
            Added
          </span>
        )}
      </div>
    </div>
  );
}
