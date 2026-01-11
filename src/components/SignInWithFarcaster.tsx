"use client";

import React, { useState, useEffect } from "react";
import { SignInButton } from "@farcaster/auth-kit";
import { QRCodeSVG } from 'qrcode.react';

type Profile = { username: string; displayName?: string; avatar?: string; fid?: number } | null;

export default function SignInWithFarcaster({ onSignInSuccess }: { onSignInSuccess?: () => void } = {}) {
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(false);

  // Load profile from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("hh_profile");
    if (stored) {
      try {
        setProfile(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  async function handleAuthKitSuccess(payload: any) {
    // AuthKit should provide a message and signature (SIWE)
    try {
      setLoading(true);
      console.log("Full AuthKit payload:", payload);
      
      const message = payload?.message ?? payload?.siweMessage;
      const signature = payload?.signature ?? payload?.siweSignature;
      const nonce = payload?.nonce ?? payload?.siweNonce;
      const domain = typeof window !== "undefined" ? window.location.hostname : undefined;

      if (!message || !signature) {
        console.error("AuthKit success payload missing message or signature", payload);
        console.log("Payload keys:", Object.keys(payload || {}));
        alert("Sign-in succeeded but no SIWE payload was returned. Please check the console for details.");
        return;
      }

      const body = { message, signature, nonce, domain };
      const apiUrl = (typeof window !== "undefined" ? window.location.origin : "") + "/api/siwf";

      let res;
      try {
        res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "same-origin",
        });
      } catch (networkErr) {
        console.error("Network error while POSTing to /api/siwf:", networkErr);
        alert("Network error: failed to contact the sign-in endpoint. Check the dev server and your network.");
        return;
      }

      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error("Failed to parse /api/siwf response", parseErr);
        alert("Error: unexpected response from sign-in endpoint.");
        return;
      }

      if (data?.profile) {
        setProfile(data.profile);
        localStorage.setItem("hh_profile", JSON.stringify(data.profile));
        
        // Immediately create signer and show approval modal
        await createSignerAndShowApproval(data.profile.fid);
        
        if (onSignInSuccess) {
          onSignInSuccess(); // Notify parent component
        }
      } else {
        console.warn("/api/siwf returned no profile", data);
        alert("Sign-in verification failed. Check server logs for details.");
      }
    } catch (e) {
      console.error("AuthKit sign-in failed:", e);
    } finally {
      setLoading(false);
    }
  }

  const createSignerAndShowApproval = async (fid: number) => {
    try {
      const key = `signer_${fid}`;
      
      // Check if signer already exists and is approved
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.signer_uuid) {
            const checkRes = await fetch(`/api/signer?signer_uuid=${parsed.signer_uuid}`);
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              if (checkData.ok && checkData.status === "approved") {
                console.log('[SignIn] Signer already approved');
                return;
              }
            }
          }
        } catch (parseErr) {
          console.error('[SignIn] Error checking existing signer:', parseErr);
        }
      }

      console.log('[SignIn] Creating new signer');
      const res = await fetch("/api/signer", { method: "POST" });
      if (!res.ok) {
        console.error('[SignIn] Failed to create signer:', res.status);
        return;
      }
      
      const data = await res.json();

      if (data.ok && data.signer_uuid) {
        localStorage.setItem(key, JSON.stringify({
          signer_uuid: data.signer_uuid,
          status: data.status,
          signer_approval_url: data.signer_approval_url
        }));

        // Show approval modal immediately if not approved
        if (data.status !== "approved") {
          setApprovalUrl(data.signer_approval_url);
          setShowApprovalModal(true);
        }
      }
    } catch (error) {
      console.error("[SignIn] Signer creation failed:", error);
    }
  };

  const handleCheckApproval = async () => {
    setCheckingApproval(true);
    try {
      const storedProfile = localStorage.getItem("hh_profile");
      if (storedProfile) {
        const profile = JSON.parse(storedProfile);
        const fid = profile?.fid;
        if (fid) {
          const key = `signer_${fid}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            const checkRes = await fetch(`/api/signer?signer_uuid=${parsed.signer_uuid}`);
            const checkData = await checkRes.json();
            
            if (checkData.ok && checkData.status === "approved") {
              // Update localStorage
              localStorage.setItem(key, JSON.stringify({
                signer_uuid: parsed.signer_uuid,
                status: 'approved'
              }));
              
              alert('✓ Signer approved! You can now interact with casts.');
              setShowApprovalModal(false);
            } else {
              alert('Signer not approved yet. Please approve in Warpcast first.');
            }
          }
        }
      }
    } catch (error) {
      console.error('Check approval error:', error);
      alert('Failed to check approval status. Please try again.');
    } finally {
      setCheckingApproval(false);
    }
  };

  // QuickAuth disabled

  function signOut() {
    setProfile(null);
    try {
      // clear any cached profile and signer entries
      localStorage.removeItem("hh_profile");
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("signer_"));
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
  }

  if (profile) {
    return (
      <>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar} alt={profile.username} className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-700" />
          )}
          <div style={{ fontWeight: 700 }}>{profile.displayName ?? profile.username}</div>
          <button onClick={signOut} className="px-3 py-1 rounded-md border">
            Sign out
          </button>
        </div>

        {/* Signer Approval Modal */}
        {showApprovalModal && approvalUrl && (
          <div 
            onClick={() => setShowApprovalModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '20px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--surface)',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '500px',
                width: '100%',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
                One More Step!
              </h3>
              <p style={{ color: 'var(--muted-on-dark)', marginBottom: 24, lineHeight: 1.6 }}>
                To interact with casts (like, recast, reply, quote), approve posting permissions in Warpcast.
                This only needs to be done once.
              </p>
              
              <div style={{ background: 'white', padding: '16px', borderRadius: '8px', display: 'inline-block', marginBottom: '16px' }}>
                <QRCodeSVG value={approvalUrl} size={200} />
              </div>
              
              <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', marginBottom: 12 }}>
                Scan this QR code or click below:
              </p>
              
              <a 
                href={approvalUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn primary" 
                style={{ display: 'block', textAlign: 'center', marginBottom: 12, padding: '14px', width: '100%', textDecoration: 'none' }}
              >
                Open Warpcast to Approve →
              </a>
              
              <button 
                onClick={handleCheckApproval}
                disabled={checkingApproval}
                className="btn primary" 
                style={{ width: '100%', padding: '14px', marginBottom: '8px' }}
              >
                {checkingApproval ? 'Checking...' : "✓ I've Approved - Check Status"}
              </button>
              
              <button 
                onClick={() => setShowApprovalModal(false)}
                className="btn" 
                style={{ width: '100%', padding: '12px' }}
              >
                I'll Do This Later
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {/* Use default SignInButton so AuthKit renders its native trigger */}
      <div style={{ transform: 'scale(0.95)' }}>
        <SignInButton onSuccess={handleAuthKitSuccess} />
      </div>
    </div>
  );
}
