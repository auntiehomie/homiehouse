"use client";

import { useState, useEffect } from "react";
import { useNeynarContext } from "@neynar/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CuratedList {
  id: number;
  list_name: string;
  description: string;
  is_public: boolean;
  created_at: string;
  item_count?: number;
}

interface ListItem {
  id: number;
  cast_hash: string;
  cast_text: string;
  cast_author_fid: number;
  cast_timestamp: string;
  created_at: string;
}

export default function CuratedListsPage() {
  const { user } = useNeynarContext();
  const router = useRouter();
  const [lists, setLists] = useState<CuratedList[]>([]);
  const [selectedList, setSelectedList] = useState<CuratedList | null>(null);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Fetch user's lists
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

  // Fetch items for selected list
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100">
        <header className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold">My Lists</h1>
          </div>
        </header>
        <div className="flex items-center justify-center p-12">
          <div className="text-zinc-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold">My Curated Lists</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {lists.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-xl font-semibold mb-2">No Lists Yet</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Mention @homiehouse with "curate this" on any cast to start a list
            </p>
            <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4 max-w-md mx-auto text-left">
              <p className="text-sm font-medium mb-2">Example:</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Reply to a cast: "@homiehouse curate this"<br />
                Bot asks: "which list?"<br />
                You reply: "cool art"<br />
                ✅ Cast added to your "cool art" list!
              </p>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Lists sidebar */}
            <div className="md:col-span-1">
              <h2 className="text-lg font-semibold mb-4">Your Lists ({lists.length})</h2>
              <div className="space-y-2">
                {lists.map(list => (
                  <button
                    key={list.id}
                    onClick={() => handleListClick(list)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedList?.id === list.id
                        ? "border-[#E87722] bg-orange-50 dark:bg-orange-950"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <div className="font-semibold">{list.list_name}</div>
                    {list.description && (
                      <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{list.description}</div>
                    )}
                    <div className="text-xs text-zinc-500 mt-2">
                      Created {new Date(list.created_at).toLocaleDateString()}
                    </div>
                  </button>
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
                                  className="text-[#E87722] hover:underline"
                                >
                                  View on Warpcast →
                                </Link>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
                              title="Remove from list"
                            >
                              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
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
