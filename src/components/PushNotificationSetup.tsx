"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

function getFid(): number | null {
  try {
    const profile = JSON.parse(localStorage.getItem('hh_profile') || 'null');
    return Number.isSafeInteger(profile?.fid) && profile.fid > 0 ? profile.fid : null;
  } catch { return null; }
}

async function setupPush(askPermission: boolean): Promise<string | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return 'Notifications are not available here. On iPhone or iPad, add Homiehouse to your Home Screen and open it there.';
  }
  const fid = getFid();
  if (!fid) return 'Sign in first, then reopen Getting started to enable notifications.';
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return 'Push notifications are not configured yet. You can still check replies and mentions in Alerts.';

  // Ask only from an explicit user action, before awaiting service worker setup.
  const permission = askPermission && Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== 'granted') return permission === 'denied'
    ? 'Notifications are blocked. You can change this in your browser or device settings.'
    : 'Notifications were not enabled. You can try again from Getting started.';

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const subscription = existing || await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fid, subscription: subscription.toJSON() }),
  });
  if (!response.ok) throw new Error('Could not save notification settings. Please try again.');
  return 'Notifications are enabled for this device.';
}

export default function PushNotificationSetup() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const restore = () => {
      if ('Notification' in window && Notification.permission === 'granted') void setupPush(false).catch(() => {});
    };
    const enable = () => {
      void setupPush(true).then(setMessage).catch(() => setMessage('Could not enable notifications. Please try again from Getting started.'));
    };
    const timer = setTimeout(restore, 8000);
    window.addEventListener('hh:push:enable', enable);
    window.addEventListener('hh:auth:changed', restore);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('hh:push:enable', enable);
      window.removeEventListener('hh:auth:changed', restore);
    };
  }, []);
  if (!message) return null;
  return <div role="status" className="surface" style={{ position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', left: 16, right: 16, maxWidth: 480, margin: '0 auto', zIndex: 10001, padding: 16 }}>
    <p style={{ margin: '0 0 8px', fontSize: 14 }}>{message}</p>
    <button className="btn" onClick={() => setMessage(null)}>Dismiss</button>
  </div>;
}
