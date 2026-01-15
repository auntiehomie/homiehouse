'use client';

import { usePrivy, useLogin } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';

export default function PrivySignIn() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { login } = useLogin({
    onComplete: ({ user, isNewUser }) => {
      console.log('Privy login complete:', { user, isNewUser });
      
      // Store Farcaster data if available
      if (user.farcaster) {
        const profile = {
          fid: user.farcaster.fid,
          username: user.farcaster.username,
          displayName: user.farcaster.displayName,
          pfpUrl: user.farcaster.pfp,
          bio: user.farcaster.bio,
        };
        localStorage.setItem('hh_profile', JSON.stringify(profile));
        // Refresh page to load components with profile data
        window.location.reload();
      }
    },
    onError: (error) => {
      console.error('Privy login error:', error);
    },
  });

  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (authenticated && user?.farcaster) {
      const profile = {
        fid: user.farcaster.fid,
        username: user.farcaster.username,
        displayName: user.farcaster.displayName,
        pfpUrl: user.farcaster.pfp,
        bio: user.farcaster.bio,
      };
      setProfile(profile);
      localStorage.setItem('hh_profile', JSON.stringify(profile));
    }
  }, [authenticated, user]);

  if (!ready) {
    return (
      <button disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
        Loading...
      </button>
    );
  }

  if (authenticated && profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {profile.pfpUrl && (
            <img
              src={profile.pfpUrl}
              alt={profile.displayName}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>
              {profile.displayName}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>
              @{profile.username}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            padding: '6px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      style={{
        padding: '10px 20px',
        background: 'var(--accent)',
        border: 'none',
        borderRadius: '8px',
        color: 'white',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '14px',
      }}
    >
      Sign in with Farcaster
    </button>
  );
}
