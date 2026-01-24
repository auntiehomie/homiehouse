'use client';

import { NeynarAuthButton, useNeynarContext } from "@neynar/react";
import "@neynar/react/dist/style.css";

export default function NeynarSignIn() {
  const { user, isAuthenticated } = useNeynarContext();

  if (isAuthenticated && user) {
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
        <NeynarAuthButton />
      </div>
    );
  }

  return <NeynarAuthButton />;
}
