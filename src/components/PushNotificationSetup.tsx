"use client";

import { useEffect } from "react";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

async function getFid(): Promise<number | null> {
  try {
    const stored = localStorage.getItem("hh_profile");
    if (!stored) return null;
    const { fid } = JSON.parse(stored);
    return fid || null;
  } catch {
    return null;
  }
}

async function setupPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return;

  const fid = await getFid();
  if (!fid) return;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      // Re-register in case server lost the record
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fid, subscription: existing.toJSON() }),
      });
      return;
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fid, subscription: subscription.toJSON() }),
    });
  } catch (err) {
    console.warn("[PushNotificationSetup] error:", err);
  }
}

export default function PushNotificationSetup() {
  useEffect(() => {
    // Delay so it doesn't compete with page load
    const t = setTimeout(setupPush, 8000);
    return () => clearTimeout(t);
  }, []);

  return null;
}
