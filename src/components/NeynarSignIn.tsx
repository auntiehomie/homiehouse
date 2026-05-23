'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useNeynarContext } from '@/hooks/useNeynarCompat';

export default function NeynarSignIn() {
  const { login, logout, authenticated } = usePrivy();
  const { user } = useNeynarContext();

  if (authenticated && user && user.fid) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {user.pfp_url && (
            <img
              src={user.pfp_url}
              alt={user.display_name}
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
              {user.display_name}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>
              @{user.username}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            border: '1px solid #333',
            background: 'transparent',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      style={{
        padding: '8px 18px',
        borderRadius: '8px',
        background: '#E87722',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '14px',
      }}
    >
      Sign in
    </button>
  );
}
