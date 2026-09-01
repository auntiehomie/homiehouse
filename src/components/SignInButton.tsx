'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { useFarcasterUser } from '@/hooks/useFarcasterUser';
import FarcasterLogin from './FarcasterLogin';

export default function SignInButton() {
  const { signIn, signOut, isAuthenticated } = useFarcasterAuth();
  const { user } = useFarcasterUser();
  const [showLogin, setShowLogin] = useState(false);

  if (isAuthenticated && user && user.fid) {
    return (
      <div className="flex items-center gap-2">
        {user.pfp_url && (
          <Link href="/profile" title="My Profile">
            <img
              src={user.pfp_url}
              alt={user.display_name}
              className="w-8 h-8 rounded-full object-cover shrink-0 hover:ring-2 hover:ring-zinc-400 transition-all"
            />
          </Link>
        )}
        {/* Name/username — hidden on small screens */}
        <div className="hidden sm:block leading-tight">
          <div className="font-semibold text-sm">{user.display_name}</div>
          <div className="text-xs opacity-60">@{user.username}</div>
        </div>
        {/* Sign out — icon on mobile, text on sm+ */}
        <button
          onClick={signOut}
          title="Sign out"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors text-xs shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowLogin(true)}
        className="px-4 py-2 rounded-lg bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-colors shrink-0"
      >
        Sign in
      </button>
      {showLogin && (
        <FarcasterLogin
          modal
          onDismiss={() => setShowLogin(false)}
          onLogin={() => setShowLogin(false)}
        />
      )}
    </>
  );
}
