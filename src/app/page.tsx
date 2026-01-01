"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ComposeModal from "../components/ComposeModal";
import FeedTrendingTabs from "../components/FeedTrendingTabs";
import TrendingList from "../components/TrendingList";
import SignInWithFarcaster from "../components/SignInWithFarcaster";
import WalletButton from "../components/WalletButton";
import WalletDashboard from "../components/WalletDashboard";
import { useProfile } from "@farcaster/auth-kit";

const MESSAGES = [
  "HomieHouse - Your Social Hub",
  "Cast, learn, and grow with Ask Homie",
  "Log in to start"
];

export default function Home() {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [showLanding, setShowLanding] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Wait for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if user has previously signed in - only check localStorage
  useEffect(() => {
    if (!mounted) return;
    
    const storedProfile = localStorage.getItem("hh_profile");
    if (storedProfile) {
      try {
        setUserProfile(JSON.parse(storedProfile));
        setShowLanding(false);
      } catch (e) {
        setShowLanding(true);
      }
    } else {
      setShowLanding(true);
    }
  }, [mounted]);

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
        <header className="px-6 py-8 flex justify-end">
          <SignInWithFarcaster onSignInSuccess={() => {
            setShowLanding(false);
            // Reload profile after sign in
            const storedProfile = localStorage.getItem("hh_profile");
            if (storedProfile) {
              try {
                setUserProfile(JSON.parse(storedProfile));
              } catch (e) {}
            }
          }} />
        </header>
        
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-5xl w-full">
            <h1 
              className={`text-5xl md:text-6xl font-bold transition-opacity duration-500 ${fade ? 'opacity-100' : 'opacity-0'}`}
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
      <header className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">HomieHouse</h1>
          <nav className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/">Home</Link>
            <span className="px-2">·</span>
            <Link href="/ask-homie">Ask Homie</Link>
          </nav>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <WalletButton />
          <ComposeModal />
          <SignInWithFarcaster />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Wallet Sidebar */}
          <aside className="md:col-span-3">
            <WalletDashboard />
          </aside>

          {/* Main Content */}
          <div className="md:col-span-9">
            <section className="mb-8 text-center">
              <h2 className="text-3xl font-bold mb-2">HomieHouse - Your Social Hub</h2>
              <p className="text-lg text-zinc-600 dark:text-zinc-400">Your place to share what's on your mind</p>
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <h3 className="text-xl font-semibold mb-4">Explore</h3>
                <FeedTrendingTabs />
              </div>

              <aside className="p-4 border rounded-md">
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