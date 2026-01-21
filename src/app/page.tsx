"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import ComposeModal from "../components/ComposeModal";
import FeedTrendingTabs from "../components/FeedTrendingTabs";
import TrendingList from "../components/TrendingList";
import PrivySignIn from "../components/PrivySignIn";
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
  
  // Safe Privy hook usage with fallback
  let ready = false;
  let authenticated = false;
  
  try {
    const privyState = usePrivy();
    ready = privyState.ready;
    authenticated = privyState.authenticated;
  } catch (error) {
    console.error('[Home] Error using Privy hook:', error);
    // Fallback to checking localStorage
    if (typeof window !== 'undefined') {
      const profile = localStorage.getItem('hh_profile');
      authenticated = !!profile;
      ready = true;
    }
  }

  // Wait for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const showLanding = !authenticated;

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

  // Prevent hydration mismatch - show nothing until mounted and Privy ready
  if (!mounted || !ready) {
    return null;
  }

  // Landing page for unauthenticated users
  if (showLanding) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100 flex flex-col">
        <header className="px-6 py-8 flex justify-end">
          <PrivySignIn />
        </header>
        
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-5xl w-full" style={{ marginLeft: '5%' }}>
            <h1 
              className={`text-6xl md:text-7xl font-bold transition-opacity duration-500 ${fade ? 'opacity-100' : 'opacity-0'}`}
              style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', margin: '0 auto' }}
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
      <header className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">HomieHouse</h1>
          <PrivySignIn />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Sidebar - Channels (hidden on mobile) */}
          <aside className="hidden md:flex md:col-span-2 flex-col gap-6">
            <ChannelsList />
          </aside>

          {/* Main Content */}
          <div className="md:col-span-9 md:col-start-4">
            <section className="mb-6 text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Your Social Hub</h2>
              <p className="text-base md:text-lg text-zinc-600 dark:text-zinc-400">Share what's on your mind</p>
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <h3 className="text-xl font-semibold mb-4">Explore</h3>
                <FeedTrendingTabs />
              </div>

              <aside className="hidden lg:block p-4 border rounded-md">
                <h3 className="font-medium">Trending</h3>
                <TrendingList />
              </aside>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}