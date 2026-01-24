'use client';

import { NeynarAuthButton, useNeynarContext } from "@neynar/react";
import { useEffect } from 'react';
import "@neynar/react/dist/style.css";

export default function NeynarAuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useNeynarContext();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Store user profile in localStorage for backward compatibility
      const profile = {
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
        bio: user.profile?.bio?.text || '',
      };
      localStorage.setItem('hh_profile', JSON.stringify(profile));
    } else {
      // Clear profile when logged out
      localStorage.removeItem('hh_profile');
    }
  }, [isAuthenticated, user]);

  return <>{children}</>;
}
