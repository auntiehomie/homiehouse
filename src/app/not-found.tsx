// Prevent static prerendering — the root layout uses Farcaster auth context
// which requires a live React tree and can't run in a static build worker.
export const dynamic = 'force-dynamic';

export default function NotFound() {
  return null; // BottomNav + layout handle the actual 404 UI
}