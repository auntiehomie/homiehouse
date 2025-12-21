"use client";

import React, { useEffect, useState } from "react";
import { SignInButton } from "@farcaster/auth-kit";

type Profile = { username: string; displayName?: string; avatar?: string } | null;

export default function SignInWithFarcaster() {
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // try to restore session from localStorage
    try {
      const raw = localStorage.getItem("hh_profile");
      if (raw) setProfile(JSON.parse(raw));
    } catch (e) {
      // ignore
    }
  }, []);

  async function handleAuthKitSuccess(payload: any) {
    // AuthKit should provide a message and signature (SIWE)
    try {
      setLoading(true);
      const message = payload?.message ?? payload?.siweMessage;
      const signature = payload?.signature ?? payload?.siweSignature;
      const nonce = payload?.nonce ?? payload?.siweNonce;
      const domain = typeof window !== "undefined" ? window.location.hostname : undefined;

      if (!message || !signature) {
        console.error("AuthKit success payload missing message or signature", payload);
        // If AuthKit didn't provide SIWE, try quickAuth fallback
        alert("Sign-in succeeded but no SIWE payload was returned. Falling back to QuickAuth if available.");
        await quickAuthSignIn();
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
        try {
          localStorage.setItem("hh_profile", JSON.stringify(data.profile));
        } catch (e) {}
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

  // Keep quickAuth fallback for dev environments where window.sdk exists
  async function quickAuthSignIn() {
    setLoading(true);
    try {
      const sdk = (window as any).sdk;
      let token: string | null = null;
      if (sdk && sdk.quickAuth && typeof sdk.quickAuth.getToken === "function") {
        token = await sdk.quickAuth.getToken();
      }

      if (!token) {
        // open docs as a helpful fallback
        window.open("https://docs.farcaster.xyz/auth-kit/", "_blank");
        return;
      }

      const res = await fetch("/api/siwf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (data?.profile) {
        setProfile(data.profile);
        try {
          localStorage.setItem("hh_profile", JSON.stringify(data.profile));
        } catch (e) {}
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    setProfile(null);
    try {
      localStorage.removeItem("hh_profile");
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
      <div>
        <SignInButton onSuccess={handleAuthKitSuccess} />
      </div>

      <div>
        <button
          onClick={quickAuthSignIn}
          className="px-3 py-1 rounded-md border text-sm text-zinc-400"
          disabled={loading}
          title="Dev fallback: signs in with the mocked host SDK"
        >
          {loading ? "Signing in…" : "QuickAuth (dev)"}
        </button>
      </div>
    </div>
  );
}
