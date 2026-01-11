"use client";

import React, { useState, useEffect } from "react";

type Profile = { 
  username: string; 
  displayName?: string; 
  avatar?: string; 
  fid?: number;
  signerUuid?: string;
} | null;

export default function SignInWithFarcaster({ onSignInSuccess }: { onSignInSuccess?: () => void } = {}) {
  const [profile, setProfile] = useState<Profile>(null);
  const [signingIn, setSigningIn] = useState(false);

  // Load profile from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("hh_profile");
    if (stored) {
      try {
        setProfile(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  async function handleNeynarSignIn() {
    try {
      setSigningIn(true);
      
      // Call Neynar auth endpoint
      const res = await fetch("/api/neynar-auth", { 
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      const data = await res.json();
      
      if (data.ok && data.signerUrl) {
        // Open Neynar auth in new window
        const authWindow = window.open(
          data.signerUrl,
          "neynar-auth",
          "width=500,height=700"
        );
        
        // Poll for completion
        const checkAuth = setInterval(async () => {
          try {
            const checkRes = await fetch(`/api/neynar-auth?token=${data.token}`);
            const checkData = await checkRes.json();
            
            if (checkData.ok && checkData.profile) {
              clearInterval(checkAuth);
              authWindow?.close();
              
              // Save profile with signer
              const profileData = {
                ...checkData.profile,
                signerUuid: checkData.signerUuid
              };
              setProfile(profileData);
              localStorage.setItem("hh_profile", JSON.stringify(profileData));
              
              // Save signer separately for compatibility
              if (checkData.profile.fid && checkData.signerUuid) {
                localStorage.setItem(`signer_${checkData.profile.fid}`, JSON.stringify({
                  signer_uuid: checkData.signerUuid,
                  status: 'approved'
                }));
              }
              
              setSigningIn(false);
              if (onSignInSuccess) {
                onSignInSuccess();
              }
            }
          } catch (e) {
            console.error("Auth check error:", e);
          }
        }, 2000);
        
        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(checkAuth);
          setSigningIn(false);
        }, 300000);
      } else {
        alert("Failed to start authentication");
        setSigningIn(false);
      }
    } catch (error) {
      console.error("Sign in error:", error);
      alert("Failed to sign in. Please try again.");
      setSigningIn(false);
    }
  }

  function signOut() {
    setProfile(null);
    try {
      localStorage.removeItem("hh_profile");
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("signer_"));
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
  }

  if (profile) {
    return (
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
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button 
        onClick={handleNeynarSignIn}
        disabled={signingIn}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
      >
        {signingIn ? "Signing in..." : "Sign in with Farcaster"}
      </button>
    </div>
  );
}
