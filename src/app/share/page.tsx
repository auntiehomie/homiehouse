"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

/**
 * /share — Web Share Target handler
 *
 * When a user taps "Share" on a Farcaster cast or external link and selects
 * HomieHouse, this page receives the shared data via URL search params:
 *   ?title=...&text=...&url=...
 *
 * It pre-populates the compose flow with the shared content.
 */
function ShareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const title = searchParams.get("title") || "";
  const text = searchParams.get("text") || "";
  const url = searchParams.get("url") || "";

  // Build a pre-filled cast text from shared data
  const sharedText = [title, text, url].filter(Boolean).join("\n").trim();

  const [castText, setCastText] = useState(sharedText);
  const [status, setStatus] = useState<"idle" | "composing" | "redirecting">("idle");

  useEffect(() => {
    if (sharedText) {
      setStatus("composing");
    }
  }, [sharedText]);

  const handleCompose = () => {
    // Redirect to compose page with pre-filled text
    const params = new URLSearchParams();
    if (castText) params.set("text", castText);
    router.push(`/compose?${params.toString()}`);
  };

  const handleViewFeed = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-surface rounded-2xl shadow-lg p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white text-lg">🏠</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">HomieHouse</h1>
              <p className="text-sm text-text-secondary">Share to Farcaster</p>
            </div>
          </div>

          {sharedText ? (
            <>
              <p className="text-sm text-text-secondary mb-3">Shared content:</p>
              <textarea
                className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                rows={5}
                value={castText}
                onChange={(e) => setCastText(e.target.value)}
                maxLength={320}
                placeholder="What's on your mind?"
              />
              <p className="text-xs text-text-secondary mt-1 text-right">
                {castText.length}/320
              </p>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleCompose}
                  className="flex-1 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
                >
                  Compose Cast
                </button>
                <button
                  onClick={handleViewFeed}
                  className="px-4 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-surface-hover transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-text-secondary mb-4 text-sm">
                No content was shared. Head to your feed or compose a new cast.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push("/compose")}
                  className="flex-1 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
                >
                  New Cast
                </button>
                <button
                  onClick={handleViewFeed}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-border text-text-secondary hover:bg-surface-hover transition-colors text-sm"
                >
                  Feed
                </button>
              </div>
            </>
          )}

          <div className="mt-4 pt-4 border-t border-border text-center">
            <Link href="/" className="text-xs text-text-secondary hover:text-primary transition-colors">
              ← Back to HomieHouse
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    }>
      <ShareContent />
    </Suspense>
  );
}
