/**
 * Mini App Host helpers for embedding Farcaster Mini Apps in iframes.
 *
 * Uses @farcaster/miniapp-host for the host-side comlink transport
 * and @farcaster/miniapp-core for typed SDK contracts.
 */
import { exposeToIframe } from '@farcaster/miniapp-host';
import type {
  MiniAppHost,
  MiniAppClientEvent,
} from '@farcaster/miniapp-core';
import { Context } from '@farcaster/miniapp-core';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Configuration passed to createMiniAppHost. */
export interface MiniAppHostConfig {
  /**
   * Context data describing the host environment.
   * Populated from the frame / mini app request payload at runtime.
   */
  context?: Partial<Context.MiniAppContext>;

  /** Additional handlers that override or extend default SDK stubs. */
  overrides?: Partial<Omit<MiniAppHost, 'ethProviderRequestV2'>>;
}

/** Cleanup handle returned by mountMiniApp. */
export type MiniAppCleanup = () => void;

/** Structured payload for frame actions dispatched into the iframe. */
export interface FrameActionPayload {
  action: string;
  data?: Record<string, unknown>;
}

/** Returned by createMiniAppHost. */
export interface MiniAppHostHandle {
  /**
   * Mount a mini app iframe by exposing the host-side SDK via comlink.
   * Returns a cleanup function that tears down the host endpoint.
   */
  mountMiniApp(iframe: HTMLIFrameElement, snapUrl: string): MiniAppCleanup;

  /**
   * Send a frame action event into the embedded mini app.
   * The action is dispatched as a custom frame_action client event.
   */
  sendFrameAction(iframe: HTMLIFrameElement, action: FrameActionPayload): void;
}

// ---------------------------------------------------------------------------
// Default stub builders
// ---------------------------------------------------------------------------

function buildDefaultContext(
  overrides?: Partial<Context.MiniAppContext>,
): Context.MiniAppContext {
  return {
    client: {
      clientFid: 0,
      added: false,
      ...overrides?.client,
    },
    user: {
      fid: 0,
      ...overrides?.user,
    },
    location: overrides?.location,
    features: {
      haptics: false,
      ...overrides?.features,
    },
  };
}

function noop(..._args: unknown[]): void {
  // intentional no-op
}

async function asyncNoop<T = void>(): Promise<T> {
  return undefined as unknown as T;
}

/** Wrap a value to always return a Promise. */
function wrapPromise<T>(v: T | Promise<T>): Promise<T> {
  return v instanceof Promise ? v : Promise.resolve(v);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a mini app host handle that can mount iframes and dispatch frame
 * actions to embedded Farcaster Mini Apps.
 *
 * @example
 * ```ts
 * const host = createMiniAppHost({ context: { user: { fid: 8675 } } });
 * const cleanup = host.mountMiniApp(iframeRef.current, 'https://my-snap.vercel.app');
 * ```
 */
export function createMiniAppHost(
  config: MiniAppHostConfig = {},
): MiniAppHostHandle {
  const { context, overrides } = config;

  // Per-iframe endpoint references (stored by WeakMap so GC can collect).
  const iframeEndpoints = new WeakMap<
    HTMLIFrameElement,
    { cleanup: MiniAppCleanup; emit: (event: MiniAppClientEvent) => void }
  >();

  /**
   * Build the host-side SDK that gets exposed to the iframe.
   * Methods are no-op stubs by default — override via config.overrides
   * to wire real behaviours.
   */
  function buildSdk(
    _snapOrigin: string,
  ): Omit<MiniAppHost, 'ethProviderRequestV2'> {
    const ctx = buildDefaultContext(context);

    const sdk: Omit<MiniAppHost, 'ethProviderRequestV2'> = {
      context: ctx,

      close: () => overrides?.close?.() ?? noop(),

      ready: () => overrides?.ready?.() ?? asyncNoop(),

      openUrl: (url: string) => {
        if (overrides?.openUrl) return overrides.openUrl(url);
        window.open(url, '_blank');
      },

      signIn: (options) => {
        if (overrides?.signIn) return overrides.signIn(options);
        throw new Error('signIn not implemented - provide an override');
      },

      signManifest: (options) => {
        if (overrides?.signManifest) return overrides.signManifest(options);
        throw new Error(
          'signManifest not implemented - provide an override',
        );
      },

      setPrimaryButton: (options) =>
        overrides?.setPrimaryButton?.(options) ?? noop(),

      // ethProviderRequest has a complex overloaded type; we type-erase with
      // the actual MiniAppHost signature and delegate to the override.
      ethProviderRequest: (overrides?.ethProviderRequest ??
        async (() => {
          throw new Error(
            'ethProviderRequest not implemented - provide an override',
          );
        })) as MiniAppHost['ethProviderRequest'],

      eip6963RequestProvider: () =>
        overrides?.eip6963RequestProvider?.() ?? noop(),

      // solanaProviderRequest has a complex intersection type; delegate.
      solanaProviderRequest: (overrides?.solanaProviderRequest ??
        async (() => {
          throw new Error(
            'solanaProviderRequest not implemented - provide an override',
          );
        })) as MiniAppHost['solanaProviderRequest'],

      addFrame: () => {
        if (overrides?.addFrame) return wrapPromise(overrides.addFrame());
        if (overrides?.addMiniApp) return wrapPromise(overrides.addMiniApp());
        return asyncNoop();
      },

      addMiniApp: () => {
        if (overrides?.addMiniApp)
          return wrapPromise(overrides.addMiniApp());
        if (overrides?.addFrame) return wrapPromise(overrides.addFrame());
        return asyncNoop();
      },

      viewCast: (args) => overrides?.viewCast?.(args) ?? noop(),

      viewProfile: (args) => overrides?.viewProfile?.(args) ?? noop(),

      viewToken: (args) => overrides?.viewToken?.(args) ?? noop(),

      sendToken: (args) => {
        if (overrides?.sendToken) return overrides.sendToken(args);
        throw new Error('sendToken not implemented - provide an override');
      },

      swapToken: (args) => {
        if (overrides?.swapToken) return overrides.swapToken(args);
        throw new Error('swapToken not implemented - provide an override');
      },

      openMiniApp: (args) => {
        if (overrides?.openMiniApp)
          return wrapPromise(overrides.openMiniApp(args));
        return asyncNoop();
      },

      // composeCast has a generic signature that's hard to forward cleanly;
      // we cast through the host type.
      composeCast: (overrides?.composeCast ??
        (async () => {
          throw new Error(
            'composeCast not implemented - provide an override',
          );
        })) as MiniAppHost['composeCast'],

      requestCameraAndMicrophoneAccess: () => {
        if (overrides?.requestCameraAndMicrophoneAccess)
          return wrapPromise(overrides.requestCameraAndMicrophoneAccess());
        return asyncNoop();
      },

      impactOccurred: (style) =>
        overrides?.impactOccurred?.(style) ?? noop(),

      notificationOccurred: (type) =>
        overrides?.notificationOccurred?.(type) ?? noop(),

      selectionChanged: () => overrides?.selectionChanged?.() ?? noop(),

      getCapabilities: () =>
        overrides?.getCapabilities?.() ?? Promise.resolve([]),

      getChains: () => overrides?.getChains?.() ?? Promise.resolve([]),

      updateBackState: (state) =>
        overrides?.updateBackState?.(state) ?? noop(),
    };

    return sdk;
  }

  function mountMiniApp(
    iframe: HTMLIFrameElement,
    snapUrl: string,
  ): MiniAppCleanup {
    const snapOrigin = new URL(snapUrl).origin;
    const sdk = buildSdk(snapOrigin);

    // Remove any previous mount for this iframe.
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
      // Dispatch a custom event into the mini app. The mini app should
      // listen for MiniAppClientEvent with event === 'frame_action'.
      ref.emit({ event: 'frame_action' } as unknown as MiniAppClientEvent);

      // Also try a more structured dispatch via the action payload.
      // Some mini-app frameworks expect data on arbitrary events.
      if (action.data) {
        ref.emit({
          event: `frame_action:${action.action}`,
        } as unknown as MiniAppClientEvent);
      }
    } catch (error) {
      console.error('Failed to dispatch frame action:', error);
    }
  }

  return { mountMiniApp, sendFrameAction };
}
