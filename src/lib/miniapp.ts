import { exposeToIframe } from '@farcaster/miniapp-host';
import type { MiniAppHost, MiniAppClientEvent } from '@farcaster/miniapp-core';
import { Context } from '@farcaster/miniapp-core';

export interface MiniAppHostConfig {
  context?: Partial<Context.MiniAppContext>;
  overrides?: Partial<Omit<MiniAppHost, 'ethProviderRequestV2'>>;
}
export type MiniAppCleanup = () => void;
export interface FrameActionPayload { action: string; data?: Record<string, unknown>; }
export interface MiniAppHostHandle {
  mountMiniApp(iframe: HTMLIFrameElement, snapUrl: string): MiniAppCleanup;
  sendFrameAction(iframe: HTMLIFrameElement, action: FrameActionPayload): void;
}

function buildDefaultContext(
  overrides?: Partial<Context.MiniAppContext>,
): Context.MiniAppContext {
  return {
    client: { clientFid: 0, added: false, ...overrides?.client },
    user: { fid: 0, ...overrides?.user },
    location: overrides?.location,
    features: { haptics: false, ...overrides?.features },
  };
}

function noop(..._args: unknown[]): void {}

async function asyncNoop<T = void>(): Promise<T> {
  return undefined as unknown as T;
}

export function createMiniAppHost(
  config: MiniAppHostConfig = {},
): MiniAppHostHandle {
  const { context, overrides } = config;

  const iframeEndpoints = new WeakMap<
    HTMLIFrameElement,
    { cleanup: MiniAppCleanup; emit: (event: MiniAppClientEvent) => void }
  >();

  function buildSdk(
    _snapOrigin: string,
  ): Omit<MiniAppHost, 'ethProviderRequestV2'> {
    const ctx = buildDefaultContext(context);

    return {
      context: ctx,
      close: () => overrides?.close?.() ?? noop(),
      ready: () => overrides?.ready?.() ?? asyncNoop(),
      openUrl: (url: string) => {
        if (overrides?.openUrl) return overrides.openUrl(url);
        window.open(url, '_blank');
      },
      signIn: (options) => {
        if (overrides?.signIn) return overrides.signIn(options);
        throw new Error('signIn not implemented');
      },
      signManifest: (options) => {
        if (overrides?.signManifest) return overrides.signManifest(options);
        throw new Error('signManifest not implemented');
      },
      setPrimaryButton: (options) =>
        overrides?.setPrimaryButton?.(options) ?? noop(),

      ethProviderRequest: (overrides?.ethProviderRequest ??
        ((() => {
          throw new Error('ethProviderRequest not implemented');
        }) as unknown as MiniAppHost['ethProviderRequest'])),

      eip6963RequestProvider: () =>
        overrides?.eip6963RequestProvider?.() ?? noop(),

      solanaProviderRequest: (overrides?.solanaProviderRequest ??
        ((() => {
          throw new Error('solanaProviderRequest not implemented');
        }) as unknown as MiniAppHost['solanaProviderRequest'])),

      addFrame: (() => {
        if (overrides?.addFrame) return overrides.addFrame();
        if (overrides?.addMiniApp) return overrides.addMiniApp() as any;
        return asyncNoop() as any;
      }) as any,
      addMiniApp: (() => {
        if (overrides?.addMiniApp) return overrides.addMiniApp();
        if (overrides?.addFrame) return overrides.addFrame() as any;
        return asyncNoop() as any;
      }) as any,
      viewCast: (args) => overrides?.viewCast?.(args) ?? asyncNoop(),
      viewProfile: (args) => overrides?.viewProfile?.(args) ?? asyncNoop(),
      viewToken: (args) => overrides?.viewToken?.(args) ?? asyncNoop(),
      sendToken: (args) => {
        if (overrides?.sendToken) return overrides.sendToken(args);
        throw new Error('sendToken not implemented');
      },
      swapToken: (args) => {
        if (overrides?.swapToken) return overrides.swapToken(args);
        throw new Error('swapToken not implemented');
      },
      openMiniApp: ((args: any) => {
        if (overrides?.openMiniApp) return overrides.openMiniApp(args);
        return asyncNoop() as any;
      }) as any,
      composeCast: (overrides?.composeCast ??
        ((() => {
          throw new Error('composeCast not implemented');
        }) as unknown as MiniAppHost['composeCast'])),
      requestCameraAndMicrophoneAccess: (() => {
        if (overrides?.requestCameraAndMicrophoneAccess)
          return overrides.requestCameraAndMicrophoneAccess() as any;
        return asyncNoop() as any;
      }) as any,
      impactOccurred: (style) =>
        overrides?.impactOccurred?.(style) ?? asyncNoop(),
      notificationOccurred: (type) =>
        overrides?.notificationOccurred?.(type) ?? asyncNoop(),
      selectionChanged: () => overrides?.selectionChanged?.() ?? asyncNoop(),
      getCapabilities: () =>
        overrides?.getCapabilities?.() ?? Promise.resolve([]),
      getChains: () => overrides?.getChains?.() ?? Promise.resolve([]),
      updateBackState: (state) =>
        overrides?.updateBackState?.(state) ?? asyncNoop(),
    };
  }

  function mountMiniApp(
    iframe: HTMLIFrameElement,
    snapUrl: string,
  ): MiniAppCleanup {
    const snapOrigin = new URL(snapUrl).origin;
    const sdk = buildSdk(snapOrigin);

    const prev = iframeEndpoints.get(iframe);
    prev?.cleanup();

    const { endpoint, cleanup } = exposeToIframe({
      iframe,
      sdk,
      miniAppOrigin: snapOrigin,
    });

    iframeEndpoints.set(iframe, { cleanup, emit: endpoint.emit });

    return cleanup;
  }

  function sendFrameAction(
    iframe: HTMLIFrameElement,
    action: FrameActionPayload,
  ): void {
    const ref = iframeEndpoints.get(iframe);
    if (!ref) {
      console.warn(
        'Missing mini app host endpoint - mountMiniApp must be called first',
      );
      return;
    }

    try {
      ref.emit({
        event: 'frame_action',
        ...action,
      } as unknown as MiniAppClientEvent);
    } catch (error) {
      console.error('Failed to dispatch frame action:', error);
    }
  }

  return { mountMiniApp, sendFrameAction };
}
