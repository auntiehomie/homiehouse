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

      // Store signer information - Neynar SIWN automatically creates a signer
      // The signer_uuid is available in the user object
      if (user.signer_uuid) {
        const signerKey = `signer_${user.fid}`;
        const signerData = {
          signer_uuid: user.signer_uuid,
          status: 'approved', // Neynar SIWN signers are pre-approved
          created_at: new Date().toISOString()
        };
        localStorage.setItem(signerKey, JSON.stringify(signerData));
        console.log('Stored Neynar signer:', user.signer_uuid, 'for FID:', user.fid);
      }
    } else {
      // Clear profile when logged out
      localStorage.removeItem('hh_profile');
    }
  }, [isAuthenticated, user]);

  return <>{children}</>;
}
