'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getAuthHeaders } from '@/lib/client-auth';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price_hh2: number;
  category: 'badge' | 'theme' | 'slot';
  emoji: string;
}

interface PurchaseState {
  [itemId: string]: 'idle' | 'loading' | 'success' | 'error';
}

export default function ShopPage() {
  const router = useRouter();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFid, setUserFid] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set());

  // Load shop items and user info
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        // Load shop items
        const shopRes = await fetch('/api/hh2-shop');
        const shopData = await shopRes.json();
        if (mounted) setItems(shopData.items ?? []);

        // Get user FID from localStorage
        const storedProfile = localStorage.getItem('hh_profile');
        let fid: number | null = null;
        if (storedProfile) {
          try {
            const profile = JSON.parse(storedProfile);
            fid = profile?.fid ?? null;
          } catch {}
        }
        if (mounted && fid) {
          setUserFid(fid);

          // Get balance and owned items
          const claimRes = await fetch(`/api/claim-hh2?fid=${fid}`);
          const claimData = await claimRes.json();
          if (mounted && claimData.ok) {
            setBalance(claimData.claimable + claimData.totalClaimed);
          }

          // Check owned items from purchases
          const authHeaders = getAuthHeaders();
          const ownedRes = await fetch(`/api/hh2-purchase?fid=${fid}`, {
            headers: authHeaders ? { ...authHeaders } : undefined,
          });
          const ownedData = await ownedRes.json();
          if (mounted && ownedData.ok) {
            setOwnedItems(new Set(ownedData.owned_items ?? []));
            setBalance(ownedData.balance);
          }
        }
      } catch (err) {
        console.error('Failed to load shop:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const handlePurchase = useCallback(async (itemId: string, price: number) => {
    if (!userFid) {
      setErrorMsg('Please sign in first to make purchases.');
      return;
    }
    setPurchaseState(prev => ({ ...prev, [itemId]: 'loading' }));
    setErrorMsg(null);

    try {
      const res = await fetch('/api/hh2-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getAuthHeaders() ?? {}) },
        body: JSON.stringify({ fid: userFid, itemId }),
      });
      const data = await res.json();

      if (data.ok) {
        setPurchaseState(prev => ({ ...prev, [itemId]: 'success' }));
        if (typeof data.balance_remaining === 'number') setBalance(data.balance_remaining);
        setOwnedItems(prev => new Set([...prev, itemId]));
      } else {
        setPurchaseState(prev => ({ ...prev, [itemId]: 'error' }));
        setErrorMsg(data.error || 'Purchase failed');
      }
    } catch {
      setPurchaseState(prev => ({ ...prev, [itemId]: 'error' }));
      setErrorMsg('Network error. Please try again.');
    }
  }, [userFid]);

  const categoryLabels: Record<string, string> = {
    badge: 'Profile Badges',
    theme: 'Cast Themes',
    slot: 'List Slots',
  };

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ShopItem[]>);

  const categoryOrder = ['badge', 'theme', 'slot'];

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>HH2 Shop</h1>
      </div>

      {/* Balance banner */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ fontSize: 28 }}>🪙</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>Your HH2 Balance</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-on-dark)' }}>
            {balance !== null ? balance.toLocaleString() : '—'} HH2
          </div>
        </div>
        <button
          onClick={() => router.push('/hh2')}
          style={{
            padding: '7px 14px', borderRadius: 8, background: 'var(--accent)', color: '#fff',
            border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Earn HH2 →
        </button>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 20,
          fontSize: 13, color: '#ef4444',
        }}>
          {errorMsg}
        </div>
      )}

      {/* Shop items by category */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {categoryOrder.map(category => {
          const catItems = grouped[category];
          if (!catItems || catItems.length === 0) return null;
          return (
            <div key={category}>
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--muted-on-dark)', marginBottom: 12,
              }}>
                {categoryLabels[category] ?? category}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {catItems.map(item => {
                  const owned = ownedItems.has(item.id);
                  const state = purchaseState[item.id] || 'idle';
                  const afford = balance !== null && balance >= item.price_hh2;

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: 'var(--surface)', border: owned ? '2px solid #22c55e' : '1px solid var(--border)',
                        borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10,
                        opacity: owned ? 0.8 : 1,
                      }}
                    >
                      <div style={{ fontSize: 28, textAlign: 'center' }}>{item.emoji}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-on-dark)', marginBottom: 4 }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', lineHeight: 1.5 }}>
                          {item.description}
                        </div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                        {item.price_hh2.toLocaleString()} HH2
                      </div>

                      {owned ? (
                        <div style={{
                          padding: '8px 12px', borderRadius: 8, textAlign: 'center',
                          background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                          fontSize: 13, fontWeight: 600,
                        }}>
                          ✓ Owned
                        </div>
                      ) : state === 'loading' ? (
                        <div style={{
                          padding: '8px 12px', borderRadius: 8, textAlign: 'center',
                          background: 'var(--bg-dark)', color: 'var(--muted-on-dark)',
                          fontSize: 13,
                        }}>
                          Processing…
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePurchase(item.id, item.price_hh2)}
                          disabled={!afford}
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: 8,
                            background: afford ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                            color: afford ? '#fff' : 'var(--muted-on-dark)',
                            border: 'none', fontWeight: 600, fontSize: 13,
                            cursor: afford ? 'pointer' : 'not-allowed',
                            transition: 'opacity 0.15s',
                          }}
                        >
                          {afford ? 'Purchase' : `Need ${item.price_hh2} HH2`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted-on-dark)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No items available</div>
          <div style={{ fontSize: 13 }}>Check back soon for new shop items!</div>
        </div>
      )}
    </AppShell>
  );
}
