'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import AgentChat from '@/components/AgentChat';
import FeedCurationChat from '@/components/FeedCurationChat';

function AskHomieContent() {
  const [castContext, setCastContext] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showCurationModal, setShowCurationModal] = useState(false);
  const searchParams = useSearchParams();

  // Load user ID from profile if available
  useEffect(() => {
    try {
      const profile = localStorage.getItem('hh_profile');
      if (profile) {
        const parsed = JSON.parse(profile);
        if (parsed.fid) {
          setUserId(`fid_${parsed.fid}`);
        }
      }
    } catch (e) {
      console.error('Failed to load user profile', e);
    }
  }, []);

  // Load cast context from URL or localStorage
  useEffect(() => {
    const castData = searchParams.get('cast');
    if (castData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(castData));
        setCastContext(decoded);
        localStorage.setItem('hh_ask_context', castData);
      } catch (e) {
        console.error('Failed to parse cast data', e);
      }
    } else {
      const stored = localStorage.getItem('hh_ask_context');
      if (stored) {
        try {
          setCastContext(JSON.parse(decodeURIComponent(stored)));
        } catch (e) {}
      }
    }
  }, [searchParams]);

  const handleCastSelect = (cast: string) => {
    // Copy to clipboard
    navigator.clipboard.writeText(cast);
    alert('Cast copied to clipboard! You can now paste it in the compose view.');
  };

  const clearContext = () => {
    setCastContext(null);
    localStorage.removeItem('hh_ask_context');
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black text-black dark:text-white">
      <header className="border-b border-zinc-200 dark:border-zinc-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/" className="text-2xl font-semibold hover:opacity-80">
              HomieHouse
            </Link>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              AI-powered Farcaster assistant
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCurationModal(true)}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              ⚙️ Curate Feed
            </button>
            <Link
              href="/"
              className="text-sm text-blue-500 hover:underline"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto flex flex-col">{castContext && (
          <div className="m-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="font-medium text-sm text-blue-900 dark:text-blue-100">
                📌 Analyzing this cast:
              </div>
              <button
                onClick={clearContext}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear context
              </button>
            </div>
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              <div className="font-medium mb-1">
                <Link
                  href={`/profile?user=${castContext.author?.username || castContext.author}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  @{castContext.author?.username || castContext.author}
                </Link>
                {castContext.author?.display_name && (
                  <span className="text-zinc-500 dark:text-zinc-400 ml-2">
                    ({castContext.author.display_name})
                  </span>
                )}
              </div>
              <div className="mt-2 p-2 bg-white dark:bg-zinc-800 rounded border border-blue-100 dark:border-blue-900">
                {castContext.text}
              </div>
              {(castContext.reactions || castContext.replies) && (
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex gap-3">
                  {castContext.reactions?.likes_count !== undefined && (
                    <span>❤️ {castContext.reactions.likes_count} likes</span>
                  )}
                  {castContext.reactions?.recasts_count !== undefined && (
                    <span>🔁 {castContext.reactions.recasts_count} recasts</span>
                  )}
                  {castContext.replies?.count !== undefined && (
                    <span>💬 {castContext.replies.count} replies</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 m-4 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-lg">
          <AgentChat
            userId={userId || undefined}
            castContext={castContext}
            onCastSelect={handleCastSelect}
          />
        </div>
      </main>

      {/* Curation Modal */}
      {showCurationModal && (
        <FeedCurationChat onClose={() => setShowCurationModal(false)} />
      )}
    </div>
  );
}

export default function AskHomiePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AskHomieContent />
    </Suspense>
  );
}
