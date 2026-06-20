import { NextResponse } from 'next/server';

// VERCEL_GIT_COMMIT_SHA is identical across all instances of the same deployment,
// so every function instance returns byte-for-byte identical SW content.
// This prevents the false-update loop caused by Date.now() differing per instance.
// Changes between commits → browser detects a real new SW → shows the update banner once.
const DEPLOY_ID = process.env.VERCEL_GIT_COMMIT_SHA || 'dev';

const SW_CONTENT = `
// HomieHouse SW — ${DEPLOY_ID}
self.addEventListener('install', () => {
  // intentionally no skipWaiting — UpdateBanner controls when to apply
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'HomieHouse', body: '', url: '/notifications' };
  try {
    if (event.data) data = { ...data, ...JSON.parse(event.data.text()) };
  } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/favicon-32.png',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/notifications';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
`.trim();

export async function GET() {
  return new NextResponse(SW_CONTENT, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
