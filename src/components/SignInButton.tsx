'use client';

import { useState } from 'react';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import FarcasterLogin from './FarcasterLogin';

export default function SignInButton() {
  const { isAuthenticated } = useFarcasterAuth();
  const [showLogin, setShowLogin] = useState(false);

  // The signed-in identity, account FID, learning totals, and sign-out action
  // live together in the navigation menu to keep the mobile header uncluttered.
  if (isAuthenticated) return null;

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
