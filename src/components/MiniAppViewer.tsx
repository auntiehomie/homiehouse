'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import type {
  MiniAppHost,
  MiniAppHostCapability,
} from '@farcaster/miniapp-core';
import { useAccount } from 'wagmi';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { getMiniAppIdentity } from '@/lib/miniapp-auth';
import { MiniAppEmbed } from './MiniAppEmbed';

interface OpenMiniAppDetail {
  url: string;
  title?: string;
}

interface ApprovalRequest {
  url: string;
  domain: string;
  launched: boolean;
}

interface ApprovalWaiter {
  resolve: () => void;
  reject: (error: Error) => void;
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
  const { connector, isConnected } = useAccount();
  const [app, setApp] = useState<OpenMiniAppDetail | null>(null);
  const [ethProvider, setEthProvider] = useState<unknown>(null);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const approvalWaiter = useRef<ApprovalWaiter | null>(null);

  const close = useCallback(() => {
    approvalWaiter.current?.reject(new Error('Mini App sign-in was cancelled'));
    approvalWaiter.current = null;
    setApproval(null);
    setApp(null);
  }, []);

  const navigateToMiniApp = useCallback((url: string, title?: string) => {
    const safeUrl = safeMiniAppUrl(url);
    if (!safeUrl) return;
    approvalWaiter.current?.reject(
      new Error('Mini App sign-in was cancelled by navigation'),
    );
    approvalWaiter.current = null;
    setApproval(null);
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

  const requestSignInApproval = useCallback(
    (url: string, domain: string) =>
      new Promise<void>((resolve, reject) => {
        approvalWaiter.current?.reject(
          new Error('A newer Mini App sign-in request replaced this one'),
        );
        approvalWaiter.current = { resolve, reject };
        setApproval({ url, domain, launched: false });
      }),
    [],
  );

  const launchApproval = useCallback(() => {
    if (!approval) return;
    window.open(approval.url, '_blank', 'noopener,noreferrer');
    approvalWaiter.current?.resolve();
    approvalWaiter.current = null;
    setApproval(current =>
      current ? { ...current, launched: true } : current,
    );
  }, [approval]);

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
      requestSignInApproval,
      onSignInComplete: () => setApproval(null),
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
        }) => {
          window.dispatchEvent(
            new CustomEvent('hh:compose', {
              detail: { text: options.text ?? '', embeds: options.embeds ?? [] },
            }),
          );
          if (options.close) close();
          return options.close ? undefined : { cast: null };
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
    requestSignInApproval,
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
          Sign in to HomieHouse to share your Farcaster identity with this Mini App.
        </div>
      )}

      {approval && (
        <div className="border-b border-purple-800 bg-purple-950 px-4 py-3 text-center text-sm text-purple-100">
          <div>
            {approval.launched
              ? `Waiting for approval from ${approval.domain}…`
              : `${approval.domain} is requesting Farcaster sign-in.`}
          </div>
          <button
            type="button"
            onClick={launchApproval}
            className="mt-2 rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white"
          >
            {approval.launched ? 'Open Farcaster again' : 'Approve in Farcaster'}
          </button>
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
