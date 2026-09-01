"use client";

import { useState, useEffect } from "react";
import { useFarcasterUser } from "@/hooks/useFarcasterUser";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Curator {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
}

interface CuratedList {
  id: number;
  fid: number;
  list_name: string;
  description: string;
  is_public: boolean;
  created_at: string;
  item_count?: number;
  curator?: Curator;
}

interface ListItem {
  id: number;
  cast_hash: string;
  cast_text: string;
  cast_author_fid: number;
  cast_timestamp: string;
  created_at: string;
}

type Tab = "mine" | "discover" | "following";

export default function ListsClient() {
  const { user } = useFarcasterUser();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("mine");

  const [lists, setLists] = useState<CuratedList[]>([]);
  const [discoverLists, setDiscoverLists] = useState<CuratedList[]>([]);
  const [followingLists, setFollowingLists] = useState<CuratedList[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());

  const [selectedList, setSelectedList] = useState<CuratedList | null>(null);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState<number | null>(null);
  const [followBusy, setFollowBusy] = useState<number | null>(null);

  // Fetch user's own lists
  useEffect(() => {
    if (!user?.fid) return;

    const fetchLists = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/curated-lists?fid=${user.fid}`);
        if (response.ok) {
          const data = await response.json();
          setLists(data.lists || []);
        }
      } catch (error) {
        console.error("Error fetching lists:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLists();
  }, [user]);

  // Fetch public (Discover) lists
  useEffect(() => {
    if (tab !== "discover") return;
    fetch(`/api/curated-lists?public=true`)
      .then((r) => r.json())
      .then((data) => setDiscoverLists(data.lists || []))
      .catch(() => setDiscoverLists([]));
  }, [tab]);

  // Fetch followed lists
  const fetchFollowing = () => {
    if (!user?.fid) return;
    fetch(`/api/curated-lists/followed?fid=${user.fid}`)
      .then((r) => r.json())
      .then((data) => {
        const followed: CuratedList[] = data.lists || [];
        setFollowingLists(followed);
        setFollowedIds(new Set(followed.map((l) => l.id)));
      })
      .catch(() => {});
  };
  useEffect(() => {
    if (tab === "following" && user?.fid) fetchFollowing();
  }, [tab, user?.fid]);

  // Following state also needed on the Discover tab (to show "Following" vs "Follow")
  useEffect(() => {
    if (user?.fid) fetchFollowing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.fid]);

  const fetchListItems = async (listId: number) => {
    setItemsLoading(true);
    try {
      const response = await fetch(`/api/curated-lists/${listId}/items`);
      if (response.ok) {
        const data = await response.json();
        setListItems(data.items || []);
      }
    } catch (error) {
      console.error("Error fetching list items:", error);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleListClick = (list: CuratedList) => {
    setSelectedList(list);
    fetchListItems(list.id);
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!selectedList) return;

    const confirmed = confirm("Remove this cast from the list?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/curated-lists/${selectedList.id}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId })
      });

      if (response.ok) {
        setListItems(prev => prev.filter(item => item.id !== itemId));
      }
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const toggleVisibility = async (list: CuratedList) => {
    if (!user?.fid) return;
    setVisibilityBusy(list.id);
    try {
      const res = await fetch("/api/curated-lists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: list.id, fid: user.fid, isPublic: !list.is_public }),
      });
      if (res.ok) {
        const data = await res.json();
        setLists((prev) => prev.map((l) => (l.id === list.id ? { ...l, is_public: data.list.is_public } : l)));
      }
    } catch (error) {
      console.error("Error updating visibility:", error);
    } finally {
      setVisibilityBusy(null);
    }
  };

  const toggleFollow = async (list: CuratedList) => {
    if (!user?.fid) return;
    setFollowBusy(list.id);
    const isFollowing = followedIds.has(list.id);
    try {
      if (isFollowing) {
        await fetch(`/api/curated-lists/${list.id}/follow?followerFid=${user.fid}`, { method: "DELETE" });
      } else {
        await fetch(`/api/curated-lists/${list.id}/follow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ followerFid: user.fid }),
        });
      }
      fetchFollowing();
    } catch (error) {
      console.error("Error toggling follow:", error);
    } finally {
      setFollowBusy(null);
    }
  };

  const displayListItems = tab === "mine" ? lists : tab === "discover" ? discoverLists : followingLists;

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-zinc-100 dark:text-zinc-100">
        <header className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold">Lists</h1>
          </div>
        </header>
        <div className="flex items-center justify-center p-12">
          <div className="text-zinc-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-100 dark:text-zinc-100">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold">Lists</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { id: "mine" as Tab, label: `Your Lists (${lists.length})` },
            { id: "discover" as Tab, label: "Discover" },
            { id: "following" as Tab, label: `Following (${followingLists.length})` },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedList(null); setListItems([]); }}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                tab === t.id
                  ? "border-white bg-zinc-900 dark:bg-zinc-950 text-white"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
          <Link
            href="/lists/feed"
            className="rounded-full border border-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
          >
            📜 Following Feed
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === "mine" && lists.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-xl font-semibold mb-2">No Lists Yet</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Mention @auntiehomie with "curate this" on any cast to save it to a list
            </p>
            <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4 max-w-md mx-auto text-left">
              <p className="text-sm font-medium mb-2">Example:</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Reply to a cast: &quot;@auntiehomie curate this cool art&quot;<br />
                ✅ Cast added to your &quot;cool art&quot; list!
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
                Tip: If you don&apos;t include a list name, the bot will ask which list to save it to.
              </p>
            </div>
          </div>
        ) : tab === "discover" && discoverLists.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">No public lists yet — be the first to make one public.</div>
        ) : tab === "following" && followingLists.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            Not following any lists yet — check Discover to find public lists from others.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Lists sidebar */}
            <div className="md:col-span-1">
              <h2 className="text-lg font-semibold mb-4">
                {tab === "mine" ? `Your Lists (${lists.length})` : tab === "discover" ? `Public Lists (${discoverLists.length})` : `Following (${followingLists.length})`}
              </h2>
              <div className="space-y-2">
                {displayListItems.map(list => (
                  <div
                    key={list.id}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedList?.id === list.id
                        ? "border-white bg-zinc-900 dark:bg-zinc-950"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <button onClick={() => handleListClick(list)} className="w-full text-left">
                      <div className="font-semibold">{list.list_name}</div>
                      {list.description && (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{list.description}</div>
                      )}
                      {list.curator?.username && tab !== "mine" && (
                        <div className="text-xs text-zinc-500 mt-1">by @{list.curator.username}</div>
                      )}
                      <div className="text-xs text-zinc-500 mt-2 flex items-center gap-2">
                        <span>{typeof list.item_count === "number" ? `${list.item_count} casts · ` : ""}Created {new Date(list.created_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                    {tab === "mine" && (
                      <button
                        onClick={() => toggleVisibility(list)}
                        disabled={visibilityBusy === list.id}
                        className={`mt-2 text-xs px-2 py-1 rounded-full border ${
                          list.is_public ? "border-emerald-600 text-emerald-500" : "border-zinc-700 text-zinc-500"
                        }`}
                      >
                        {visibilityBusy === list.id ? "…" : list.is_public ? "🌐 Public" : "🔒 Private — make public"}
                      </button>
                    )}
                    {tab === "discover" && (
                      <button
                        onClick={() => toggleFollow(list)}
                        disabled={followBusy === list.id}
                        className={`mt-2 text-xs px-3 py-1 rounded-full border ${
                          followedIds.has(list.id) ? "border-zinc-600 text-zinc-400" : "border-white text-white"
                        }`}
                      >
                        {followBusy === list.id ? "…" : followedIds.has(list.id) ? "Following" : "+ Follow"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* List items */}
            <div className="md:col-span-2">
              {!selectedList ? (
                <div className="flex items-center justify-center h-64 text-zinc-500">
                  Select a list to view its casts
                </div>
              ) : (
                <div>
                  <h2 className="text-lg font-semibold mb-4">{selectedList.list_name}</h2>

                  {itemsLoading ? (
                    <div className="flex items-center justify-center h-32 text-zinc-500">
                      Loading casts...
                    </div>
                  ) : listItems.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">
                      No casts in this list yet
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {listItems.map(item => (
                        <div
                          key={item.id}
                          className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <p className="text-sm mb-2">{item.cast_text}</p>
                              <div className="flex items-center gap-4 text-xs text-zinc-500">
                                <span>FID: {item.cast_author_fid}</span>
                                <span>•</span>
                                <span>{new Date(item.cast_timestamp).toLocaleDateString()}</span>
                                <span>•</span>
                                <Link
                                  href={`https://warpcast.com/~/conversations/${item.cast_hash}`}
                                  target="_blank"
                                  className="text-[#a1a1aa] hover:underline"
                                >
                                  View on Warpcast →
                                </Link>
                              </div>
                            </div>
                            {tab === "mine" && (
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
                                title="Remove from list"
                              >
                                <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
