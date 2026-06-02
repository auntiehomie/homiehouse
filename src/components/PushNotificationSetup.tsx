'use client';

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export default function PushNotificationSetup() {
  const { user } = usePrivy();
  const farcasterAccount = (user?.linkedAccounts ?? []).find((a: any) => a.type === 'farcaster') as any;
  const fid = farcasterAccount?.fid;

  useEffect(() => {
    if (!fid || !VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    async function setup() {
      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // Check existing permission — don't re-prompt if already granted
        if (Notification.permission === 'denied') return;

        if (Notification.permission !== 'granted') {
          // Only prompt once — after a small delay so it doesn't feel invasive
          await new Promise(r => setTimeout(r, 5000));
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') return;
        }

        // Subscribe
        const existing = await reg.pushManager.getSubscription();
        const sub = existing || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        // Send to server
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid, subscription: sub.toJSON() }),
        });
      } catch {}
    }

    setup();
  }, [fid]);

  return null;
}
