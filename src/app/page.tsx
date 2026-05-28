"use client";

import { useState, useEffect } from "react";
import { useNeynarContext } from "@/hooks/useNeynarCompat";
import ComposeModal from "../components/ComposeModal";
import ScheduledCastsModal from "../components/ScheduledCastsModal";
import FeedTrendingTabs from "../components/FeedTrendingTabs";
import NeynarSignIn from "../components/NeynarSignIn";
import ChannelsList from "../components/ChannelsList";
import WelcomeModal from "../components/WelcomeModal";

const MESSAGES = [
  "HomieHouse - Your Social Hub",
  "Cast, learn, and grow with Ask Homie",
  "Log in to start"
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [fade, setFade] = useState(true);
  
  const { isAuthenticated } = useNeynarContext();

  // Wait for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const showLanding = !isAuthenticated;

  useEffect(() => {
    if (!showLanding) return; // Stop animation when logged in

    const interval = setInterval(() => {
      setFade(false);
      
      setTimeout(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % MESSAGES.length);
        setFade(true);
      }, 500); // Half second fade out before changing text
      
    }, 3500); // Show each message for 3.5 seconds

    return () => clearInterval(interval);
  }, [showLanding]);

  // Prevent hydration mismatch - show nothing until mounted
  if (!mounted) {
    return null;
  }

  // Landing page for unauthenticated users
  if (showLanding) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col">
        <header className="px-4 sm:px-6 py-6 sm:py-8 flex justify-end">
          <NeynarSignIn />
        </header>
        
        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
          {/* Animated headline */}
          <div className="text-center max-w-5xl w-full">
            <h1 
              className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold transition-opacity duration-500 px-4 ${
                fade ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ 
                minHeight: '120px',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                textAlign: 'center', 
                margin: '0 auto' 
              }}
            >
              {MESSAGES[currentMessageIndex]}
            </h1>
          </div>

          {/* Value proposition */}
          <p className="mt-4 text-lg sm:text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl text-center px-4">
            Your home on the decentralized social web. Browse Farcaster feeds, compose casts, get AI-powered insights, and build your personal knowledge base.
          </p>

          {/* Feature grid */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-3xl w-full px-4">
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
              <span className="text-2xl">📡</span>
              <span className="text-sm font-medium text-center">Browse Feeds</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center">Follow channels &amp; people you love</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
              <span className="text-2xl">✍️</span>
              <span className="text-sm font-medium text-center">Compose Casts</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center">Post, schedule, and reply with ease</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
              <span className="text-2xl">🤖</span>
              <span className="text-sm font-medium text-center">Ask Homie</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center">AI-powered cast analysis &amp; insights</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
              <span className="text-2xl">📚</span>
              <span className="text-sm font-medium text-center">Knowledge Base</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center">Save &amp; curate your favorite casts</span>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <div className="scale-110">
              <NeynarSignIn />
            </div>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Sign in with your Farcaster account</span>
          </div>
        </main>

        <footer className="py-6 text-center text-xs text-zinc-400">
          Built on Farcaster &bull; Powered by HomieHouse
        </footer>
      </div>
    );
  }

  // Authenticated user experience
  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100">
      <WelcomeModal />
      <header className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <h1 className="text-base sm:text-xl font-bold">HomieHouse</h1>
            <p className="text-xs text-zinc-500 hidden sm:block">Your Social Hub</p>
          </div>
          {/* Search — hidden on small mobile, visible sm+ */}
          <div className="hidden sm:block flex-1 max-w-xs">
            <input
              id="header-search-input"
              placeholder="Search people..."
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-inherit text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) window.location.href = `/search?q=${encodeURIComponent(v)}`;
                }
              }}
            />
          </div>
          <div className="ml-auto">
            <NeynarSignIn />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-24 md:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start">
          {/* Left Sidebar - Channels (hidden on mobile) */}
          <aside className="hidden md:flex md:col-span-2 flex-col gap-6">
            <ChannelsList />
          </aside>

          {/* Main Content */}
          <div className="md:col-span-10">
            <section>
              <h3 className="text-lg font-semibold mb-3">Explore</h3>
              <FeedTrendingTabs />
            </section>
          </div>
        </div>
      </main>

      <ComposeModal />
      <ScheduledCastsModal />
    </div>
  );
}