"use client";

import React, { useState, useEffect } from "react";
import { SignInButton } from "@farcaster/auth-kit";

type Profile = { username: string; displayName?: string; avatar?: string } | null;

export default function SignInWithFarcaster({ onSignInSuccess }: { onSignInSuccess?: () => void } = {}) {
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(false);

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
        
        // Automatically create signer after sign-in for smoother UX
        setTimeout(() => {
          createSignerProactively(data.profile.fid);
        }, 500);
        
        onSignInSuccess?.(); // Notify parent component
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

  const createSignerProactively = async (fid: number) => {
    try {
      // Check if signer already exists
      const key = `signer_${fid}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.signer_uuid) {
          // Signer exists, check if approved
          const checkRes = await fetch(`/api/signer?signer_uuid=${parsed.signer_uuid}`);
          const checkData = await checkRes.json();
          if (checkData.ok && checkData.status === "approved") {
            // Already approved, nothing to do
            return;
          }
        }
      }

      // Create new signer
      const res = await fetch("/api/signer", { method: "POST" });
      const data = await res.json();

      if (data.ok && data.signer_uuid) {
        localStorage.setItem(key, JSON.stringify({
          signer_uuid: data.signer_uuid,
          status: data.status,
          signer_approval_url: data.signer_approval_url
        }));

        // Show welcome modal with approval instructions
        if (data.status !== "approved") {
          sessionStorage.setItem("pending_approval_url", data.signer_approval_url);
          window.dispatchEvent(new CustomEvent("showWelcomeModal", { 
            detail: { approvalUrl: data.signer_approval_url } 
          }));
        }
      }
    } catch (error) {
      console.error("Proactive signer creation failed:", error);
      // Silent fail - user can still create signer on first action
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
      {/* Use default SignInButton so AuthKit renders its native trigger */}
      <div style={{ transform: 'scale(0.95)' }}>
        <SignInButton onSuccess={handleAuthKitSuccess} />
      </div>
    </div>
  );
}
