'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function NeynarSignIn() {
  const [profile, setProfile] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [signerApprovalUrl, setSignerApprovalUrl] = useState<string | null>(null);
  const [signerUuid, setSignerUuid] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const storedProfile = localStorage.getItem('hh_profile');
    if (storedProfile) {
      try {
        const parsedProfile = JSON.parse(storedProfile);
        setProfile(parsedProfile);
      } catch (err) {
        console.error('Failed to parse stored profile:', err);
        localStorage.removeItem('hh_profile');
      }
    }
  }, []);

  const handleLogin = async () => {
    setShowLoginModal(true);
    
    try {
      // Create a new signer
      const response = await fetch('/api/signer', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create signer');
      }

      const data = await response.json();
      
      if (data.ok && data.signer_approval_url && data.signer_uuid) {
        setSignerApprovalUrl(data.signer_approval_url);
        setSignerUuid(data.signer_uuid);
        
        // Start polling for signer status
        pollSignerStatus(data.signer_uuid);
      } else {
        throw new Error('Invalid signer response');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to initiate login. Please try again.');
      setShowLoginModal(false);
    }
  };

  const pollSignerStatus = async (uuid: string) => {
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 60; // Poll for 60 seconds

    const checkStatus = async (): Promise<boolean> => {
      try {
        const response = await fetch(`/api/signer?signer_uuid=${uuid}`);
        const data = await response.json();

        if (data.status === 'approved' && data.user) {
          // Store profile
          const profile = {
            fid: data.user.fid,
            username: data.user.username,
            displayName: data.user.display_name,
            pfpUrl: data.user.pfp_url,
            bio: data.user.profile?.bio?.text || '',
          };
          
          localStorage.setItem('hh_profile', JSON.stringify(profile));
          
          // Store signer info
          localStorage.setItem(`signer_${data.user.fid}`, JSON.stringify({
            signer_uuid: uuid,
            status: 'approved'
          }));

          setProfile(profile);
          setShowLoginModal(false);
          setPolling(false);
          
          // Reload to refresh all components
          window.location.reload();
          
          return true;
        }

        return false;
      } catch (error) {
        console.error('Error checking signer status:', error);
        return false;
      }
    };

    const interval = setInterval(async () => {
      attempts++;
      
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setPolling(false);
        alert('Login timeout. Please try again.');
        setShowLoginModal(false);
        return;
      }

      const approved = await checkStatus();
      if (approved) {
        clearInterval(interval);
      }
    }, 1000);
  };

  const handleLogout = () => {
    localStorage.removeItem('hh_profile');
    // Clear all signer data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('signer_')) {
        localStorage.removeItem(key);
      }
    });
    setProfile(null);
    window.location.reload();
  };

  if (profile) {
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
