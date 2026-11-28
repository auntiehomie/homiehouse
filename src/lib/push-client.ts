import { ensureAuthHeaders } from './client-auth';
import type { PushPreferences } from './push-preferences';
function applicationKey(value: string): ArrayBuffer {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(raw, c => c.charCodeAt(0)).buffer as ArrayBuffer;
}
function sameKey(current: ArrayBuffer | null | undefined, expected: ArrayBuffer): boolean {
  // Browsers that don't expose the key: assume it matches rather than churn subscriptions.
  if (!current) return true;
  const a = new Uint8Array(current), b = new Uint8Array(expected);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
export async function enableDevicePush(fid: number, preferences: PushPreferences, askPermission: boolean, fetcher: typeof fetch = fetch) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
    throw new Error('Push is unavailable here. On iPhone/iPad, add HomieHouse to your Home Screen and open it there.');
  }
  if (!Number.isSafeInteger(fid) || fid <= 0) throw new Error('Sign in to enable notifications.');
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error('Push notifications are not configured yet. Replies and mentions are still in Alerts.');
  // Permission must be requested synchronously from a user gesture, before auth awaits.
  const permission = askPermission && Notification.permission === 'default'
    ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') throw new Error(permission === 'denied'
    ? 'Notifications are blocked. Change this in your browser/device settings.' : 'Notifications were not enabled. Try again when ready.');
  const headers = await ensureAuthHeaders('write:profile');
  if (!headers) throw new Error('Sign in again to save notification settings.');
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const serverKey = applicationKey(vapidKey);
  let existing = await registration.pushManager.getSubscription();
  // A subscription made with an older VAPID key can never receive pushes signed
  // with the current one, so replace it (permission is already granted here).
  if (existing && !sameKey(existing.options?.applicationServerKey, serverKey)) {
    await existing.unsubscribe();
    existing = null;
    if (!askPermission && Notification.permission !== 'granted') return;
  } else if (!existing && !askPermission) return;
  const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
  const response = await fetcher('/api/push/subscribe', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ fid, subscription: subscription.toJSON(), preferences }),
  });
  if (!response.ok) {
    if (!existing) await subscription.unsubscribe();
    throw new Error('Could not save notification settings. Sign in again or retry.');
  }
  localStorage.setItem(`hh_push_preferences:${fid}`, JSON.stringify(preferences));
  localStorage.setItem(`hh_push_enabled:${fid}`, 'true');
}
export async function disableDevicePush(fid: number) {
  const headers = await ensureAuthHeaders('write:profile');
  if (!headers) throw new Error('Sign in again to disable notifications.');
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    const response = await fetch('/api/push/subscribe', {
      method: 'DELETE', headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ fid, endpoint: subscription.endpoint }),
    });
    if (!response.ok) throw new Error('Could not disable notifications. Please retry.');
    await subscription.unsubscribe();
  }
  localStorage.removeItem(`hh_push_enabled:${fid}`);
}
