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
          onClick={handleLogout}
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
    <>
      <button
        onClick={handleLogin}
        style={{
          padding: '8px 16px',
          background: 'linear-gradient(180deg, #E87722 0%, #D76A1A 100%)',
          border: 'none',
          borderRadius: '8px',
          color: 'white',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
        }}
      >
        Sign In
      </button>

      {showLoginModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !polling && setShowLoginModal(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '12px',
              padding: '32px',
              maxWidth: '400px',
              width: '90%',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '16px', fontSize: '24px', fontWeight: 700 }}>
              Sign in with Farcaster
            </h2>
            
            {signerApprovalUrl ? (
              <>
                <p style={{ marginBottom: '24px', color: 'var(--muted-on-dark)' }}>
                  Scan this QR code with your phone camera or Warpcast app
                </p>
                
                <div style={{ 
                  background: 'white', 
                  padding: '16px', 
                  borderRadius: '8px',
                  display: 'inline-block',
                  marginBottom: '16px'
                }}>
                  <QRCodeSVG value={signerApprovalUrl} size={200} />
                </div>
                
                <p style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--muted-on-dark)' }}>
                  Or <a href={signerApprovalUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                    click here
                  </a> to open in Warpcast
                </p>
                
                {polling && (
                  <p style={{ fontSize: '14px', color: 'var(--accent)' }}>
                    Waiting for approval...
                  </p>
                )}
              </>
            ) : (
              <p>Loading...</p>
            )}
            
            {!polling && (
              <button
                onClick={() => setShowLoginModal(false)}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
