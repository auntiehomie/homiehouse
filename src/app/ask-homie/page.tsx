'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import AgentChat from '@/components/AgentChat';

function AskHomieContent() {
  const [castContext, setCastContext] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
          <Link
            href="/"
            className="text-sm text-blue-500 hover:underline"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto flex flex-col">
        {castContext && (
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
              <div className="font-medium">@{castContext.author}</div>
              <div className="mt-1">
                {castContext.text?.substring(0, 200)}
                {castContext.text?.length > 200 ? '...' : ''}
              </div>
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
