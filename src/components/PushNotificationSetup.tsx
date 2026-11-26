"use client";
import { useEffect, useState } from 'react';
import { enableDevicePush } from '@/lib/push-client';
import { readPushPreferences } from '@/lib/push-preferences';
function getFid(): number | null {
  try { const fid = JSON.parse(localStorage.getItem('hh_profile') || 'null')?.fid; return Number.isSafeInteger(fid) && fid > 0 ? fid : null; }
  catch { return null; }
}
export default function PushNotificationSetup() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const restore = () => {
      const fid = getFid();
      if (fid && localStorage.getItem(`hh_push_enabled:${fid}`) === 'true') {
        void enableDevicePush(fid, readPushPreferences(fid), false).catch(() => {});
      } else if ('serviceWorker' in navigator) {
        // Prevent a signed-out or switched account receiving the previous account’s alerts.
        void navigator.serviceWorker.getRegistration('/').then(async registration => {
          await (await registration?.pushManager.getSubscription())?.unsubscribe();
        }).catch(() => {});
      }
    };
    const enable = () => {
      const fid = getFid();
      if (!fid) { setMessage('Sign in first to enable notifications.'); return; }
      void enableDevicePush(fid, readPushPreferences(fid), true)
        .then(() => setMessage('Notifications are enabled for this device. Customize them in Alerts.'))
        .catch(error => setMessage(error instanceof Error ? error.message : 'Could not enable notifications.'));
    };
    const timer = setTimeout(restore, 8000);
    window.addEventListener('hh:push:enable', enable);
    window.addEventListener('hh:auth:changed', restore);
    return () => { clearTimeout(timer); window.removeEventListener('hh:push:enable', enable); window.removeEventListener('hh:auth:changed', restore); };
  }, []);
  if (!message) return null;
  return <div role="status" className="surface" style={{ position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', left: 16, right: 16, maxWidth: 480, margin: '0 auto', zIndex: 10001, padding: 16 }}>
    <p style={{ margin: '0 0 8px', fontSize: 14 }}>{message}</p><button className="btn" onClick={() => setMessage(null)}>Dismiss</button>
  </div>;
}
