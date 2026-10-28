'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import type {
  MiniAppHost,
  MiniAppHostCapability,
} from '@farcaster/miniapp-core';
import { useAccount, useSignMessage } from 'wagmi';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { getMiniAppIdentity } from '@/lib/miniapp-auth';
import { signInToMiniApp } from '@/lib/miniapp-auth';
import { requestMiniAppComposeCast } from '@/lib/compose-modal-events';
import { MiniAppEmbed } from './MiniAppEmbed';

interface OpenMiniAppDetail {
  url: string;
  title?: string;
}

const BASE_CAPABILITIES: MiniAppHostCapability[] = [
  'actions.ready',
  'actions.openUrl',
  'actions.close',
  'actions.signIn',
  'actions.viewCast',
  'actions.viewProfile',
  'actions.composeCast',
  'actions.openMiniApp',
  'haptics.impactOccurred',
  'haptics.notificationOccurred',
  'haptics.selectionChanged',
];

function safeMiniAppUrl(value: string): string | null {
  try {
    getMiniAppIdentity(value);
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function openExternalUrl(value: string): void {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  } catch {}
}

export default function MiniAppViewer({ clientFid = 0 }: { clientFid?: number }) {
  const router = useRouter();
  const { fid, username, displayName, pfpUrl, isAuthenticated } =
    useFarcasterAuth();
  const { connector, isConnected, address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [app, setApp] = useState<OpenMiniAppDetail | null>(null);
  const [ethProvider, setEthProvider] = useState<unknown>(null);

  const close = useCallback(() => {
    setApp(null);
  }, []);

  const navigateToMiniApp = useCallback((url: string, title?: string) => {
    const safeUrl = safeMiniAppUrl(url);
    if (!safeUrl) return;
    setApp({ url: safeUrl, title });
  }, []);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenMiniAppDetail>).detail;
      if (detail?.url) navigateToMiniApp(detail.url, detail.title);
    };
    window.addEventListener('hh:open-miniapp', onOpen);
    return () => window.removeEventListener('hh:open-miniapp', onOpen);
  }, [navigateToMiniApp]);

  useEffect(() => {
    if (!app) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [app, close]);

  useEffect(() => {
    let active = true;
    if (!connector || !isConnected) {
      setEthProvider(null);
      return;
    }
    connector
      .getProvider()
      .then(provider => {
        if (active) setEthProvider(provider);
      })
      .catch(() => {
        if (active) setEthProvider(null);
      });
    return () => {
      active = false;
    };
  }, [connector, isConnected]);

  const authorizeSignIn = useCallback(async ({
    miniAppUrl,
    expectedFid,
    options,
  }: {
    miniAppUrl: string;
    expectedFid: number;
    options: Parameters<MiniAppHost['signIn']>[0];
  }) => {
    if (!isAuthenticated || !fid || expectedFid !== fid) {
      throw new Error('Sign in to HomieHouse before signing in to a Mini App');
    }
    if (!isConnected || !address) {
      throw new Error('Connect the wallet linked to your social account to continue');
    }

    const response = await fetch(`/api/auth/linked-accounts?address=${encodeURIComponent(address)}`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({})) as {
      error?: string;
      accounts?: Array<{
        fid: number;
        link?: { linked: boolean; method: string };
      }>;
    };
    if (!response.ok) {
      throw new Error(data.error || 'Hypersnap could not verify the connected wallet');
    }
    const linkedAccount = data.accounts?.find(
      account => account.fid === expectedFid && account.link?.linked,
    );
    const linkedMethod = linkedAccount?.link?.method;
    const authMethod = linkedMethod === 'custody' || linkedMethod === 'authAddress'
      ? linkedMethod
      : undefined;
    if (authMethod !== 'custody' && authMethod !== 'authAddress') {
      throw new Error('The connected wallet must be the FID custody wallet or an approved Auth Address');
    }

    return signInToMiniApp({
      miniAppUrl,
      expectedFid,
      options,
      address,
      authMethod,
      signMessage: message => signMessageAsync({ message }),
    });
  }, [address, fid, isAuthenticated, isConnected, signMessageAsync]);

  const hostConfig = useMemo(() => {
    if (!app) return undefined;

    const capabilities: MiniAppHostCapability[] = ethProvider
      ? ['wallet.getEthereumProvider', ...BASE_CAPABILITIES]
      : BASE_CAPABILITIES;

    return {
      context: {
        client: {
          clientFid,
          added: false,
          platformType: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
            ? ('mobile' as const)
            : ('web' as const),
        },
        user: {
          fid: isAuthenticated ? (fid ?? 0) : 0,
          username: isAuthenticated ? (username ?? undefined) : undefined,
          displayName: isAuthenticated
            ? (displayName ?? undefined)
            : undefined,
          pfpUrl: isAuthenticated ? (pfpUrl ?? undefined) : undefined,
        },
        location: {
          type: 'open_miniapp' as const,
          referrerDomain: window.location.hostname,
        },
        features: {
          haptics: typeof navigator.vibrate === 'function',
        },
      },
      ethProvider: ethProvider as Parameters<
        typeof import('@farcaster/miniapp-host').exposeToIframe
      >[0]['ethProvider'],
      authorizeSignIn,
      overrides: {
        close,
        ready: () => undefined,
        openUrl: openExternalUrl,
        viewCast: async ({ hash }: { hash: string }) => {
          close();
          router.push(`/cast/${hash}`);
        },
        viewProfile: async ({ fid: profileFid }: { fid: number }) => {
          close();
          router.push(`/profile?user=${profileFid}`);
        },
        composeCast: (async (options: {
          text?: string;
          embeds?: string[];
          close?: boolean;
          channelKey?: string;
        }) => {
          const result = await requestMiniAppComposeCast(options);

          if (options.close) {
            close();
            return undefined;
          }
          return result ?? { cast: null };
        }) as MiniAppHost['composeCast'],
        openMiniApp: async ({ url }: { url: string }) => {
          navigateToMiniApp(url);
        },
        impactOccurred: async () => {
          navigator.vibrate?.(12);
        },
        notificationOccurred: async () => {
          navigator.vibrate?.([20, 30, 20]);
        },
        selectionChanged: async () => {
          navigator.vibrate?.(8);
        },
        getCapabilities: async () => capabilities,
        getChains: async () =>
          ethProvider
            ? ['eip155:1', 'eip155:10', 'eip155:137', 'eip155:8453', 'eip155:42161']
            : [],
      },
    };
  }, [
    app,
    close,
    clientFid,
    displayName,
    ethProvider,
    fid,
    isAuthenticated,
    navigateToMiniApp,
    pfpUrl,
    authorizeSignIn,
    router,
    username,
  ]);

  if (!app || !hostConfig) return null;

  let domain = app.url;
  try {
    domain = new URL(app.url).hostname;
  } catch {}

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={app.title || `Mini App from ${domain}`}
    >
      <header
        className="flex shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={close}
          autoFocus
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-zinc-700 bg-zinc-900 text-xl text-white"
          aria-label="Close Mini App"
        >
          ×
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-semibold text-white">
            {app.title || 'Mini App'}
          </div>
          <div className="truncate text-xs text-zinc-400">{domain}</div>
        </div>
        <div className="shrink-0">
          <ConnectButton
            accountStatus="avatar"
            chainStatus="none"
            showBalance={false}
          />
        </div>
      </header>

      {!isAuthenticated && (
        <div className="border-b border-amber-800 bg-amber-950 px-4 py-2 text-center text-sm text-amber-100">
          Sign in to HomieHouse to share your social identity with this Mini App.
        </div>
      )}

      <MiniAppEmbed
        key={app.url}
        snapUrl={app.url}
        title={app.title || `Mini App from ${domain}`}
        hostConfig={hostConfig}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
