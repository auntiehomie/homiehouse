"use client";

import { useState, useEffect } from "react";
import { useNeynarContext } from "@neynar/react";
import Link from "next/link";
import ComposeModal from "../components/ComposeModal";
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
      <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100 flex flex-col">
        <header className="px-4 sm:px-6 py-6 sm:py-8 flex justify-end">
          <NeynarSignIn />
        </header>
        
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6">
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
        </main>
      </div>
    );
  }

  // Authenticated user experience
  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100">
      <WelcomeModal />
      <header className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold">HomieHouse</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Your Social Hub</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/wallet"
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Wallet"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </Link>
            <NeynarSignIn />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-4">
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
    </div>
  );
}