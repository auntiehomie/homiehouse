// Lightweight Farcaster helper for the Next.js app
type SDK = any;

function getSdk(): SDK | undefined {
  // Some hosts expose `sdk` on window.
  // Access via (window as any).sdk to avoid TypeScript errors.
  if (typeof window === "undefined") return undefined;
  return (window as any).sdk;
}

export async function ready(timeout = 2000): Promise<void> {
  const sdk = getSdk();
  if (!sdk || !sdk.actions?.ready) return;
  try {
    await Promise.race([sdk.actions.ready(), new Promise((_, r) => setTimeout(r, timeout))]);
  } catch {
    // ignore
  }
}

export function getCapabilities(): string[] {
  const sdk = getSdk();
  return sdk?.getCapabilities ? sdk.getCapabilities() : [];
}

export function isInMiniApp(): boolean {
  const sdk = getSdk();
  return !!(sdk && sdk.isInMiniApp && sdk.isInMiniApp());
}

export async function postCast(text: string): Promise<{ ok: boolean; error?: string }> {
  const sdk = getSdk();
  if (!sdk) return { ok: false, error: "no-sdk" };

  // Prefer actions.composeCast if available
  const actions = sdk.actions;
  if (actions?.composeCast) {
    try {
      await actions.composeCast({ text });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: String(err?.message || err) };
    }
  }

  // Try other common action names
  const tries = ["createCast", "publish", "post"];
  for (const name of tries) {
    if (typeof actions?.[name] === "function") {
      try {
        await actions[name]({ text });
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: String(err?.message || err) };
      }
    }
  }

  // Last resort: if sdk.invoke exists, try a generic invoke
  if (typeof sdk.invoke === "function") {
    try {
      await sdk.invoke("composeCast", { text });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: String(err?.message || err) };
    }
  }

  return { ok: false, error: "compose-not-supported" };
}

export async function getQuickAuthToken(): Promise<string | null> {
  const sdk = getSdk();
  if (!sdk || !sdk.quickAuth?.getToken) return null;
  try {
    return await sdk.quickAuth.getToken();
  } catch {
    return null;
  }
}

export async function fetchFeed(limit = 20): Promise<any[]> {
  const sdk = getSdk();
  if (!sdk) return [];

  // Ensure host SDK has had a chance to initialize
  try {
    await ready(1500);
  } catch {
    /* ignore */
  }

  // Try a variety of common feed read APIs and normalize results to an array
  const tries = [
    async () => sdk.api?.feed?.getHome?.({ limit }),
    async () => sdk.api?.getHome?.({ limit }),
    async () => sdk.api?.getFeed?.({ limit }),
    async () => sdk.api?.feed?.getTimeline?.({ limit }),
    async () => (typeof sdk.invoke === 'function' ? sdk.invoke('getFeed', { limit }) : undefined),
    async () => (typeof sdk.invoke === 'function' ? sdk.invoke('getHomeFeed', { limit }) : undefined),
  ];

  for (const fn of tries) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fn();
      if (!res) continue;

      // Some SDKs return { data: [...] }
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      // Some SDKs return an object with a 'casts' or 'items' field
      if (Array.isArray(res?.casts)) return res.casts;
      if (Array.isArray(res?.items)) return res.items;
      // Otherwise, attempt to coerce single item into array
      return [res];
    } catch (err) {
      // ignore and try next
    }
  }

  return [];
}

export async function fetchTrending(limit = 20): Promise<any[]> {
  const sdk = getSdk();
  if (!sdk) return [];

  try {
    await ready(1500);
  } catch {
    /* ignore */
  }

  const tries = [
    async () => sdk.api?.feed?.getTrending?.({ limit }),
    async () => sdk.api?.getTrending?.({ limit }),
    async () => (typeof sdk.invoke === 'function' ? sdk.invoke('getTrending', { limit }) : undefined),
  ];

  for (const fn of tries) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fn();
      if (!res) continue;
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.casts)) return res.casts;
      if (Array.isArray(res?.items)) return res.items;
      return [res];
    } catch {
      // ignore
    }
  }

  return [];
}

export async function quickAuthFetch(input: RequestInfo, init?: RequestInit) {
  const sdk = getSdk();
  if (sdk?.quickAuth?.fetch) {
    return sdk.quickAuth.fetch(input, init);
  }
  // Fallback to window.fetch
  return fetch(input, init);
}

export function openUrl(url: string) {
  const sdk = getSdk();
  if (sdk?.actions?.openUrl) return sdk.actions.openUrl(url);
  if (typeof window !== "undefined") window.open(url, "_blank");
}

export function openMiniApp(miniAppUrl: string) {
  const sdk = getSdk();
  if (sdk?.actions?.openMiniApp) return sdk.actions.openMiniApp(miniAppUrl);
  if (typeof window !== "undefined") window.open(miniAppUrl, "_blank");
}

export function inspectSDK() {
  const sdk = getSdk();
  if (!sdk) return { present: false };
  return {
    present: true,
    actions: Object.keys(sdk.actions || {}),
    hasQuickAuth: !!sdk.quickAuth,
    hasApi: !!sdk.api,
    capabilities: typeof sdk.getCapabilities === "function" ? sdk.getCapabilities() : undefined,
    raw: sdk,
  };
}

export default {
  ready,
  getCapabilities,
  isInMiniApp,
  postCast,
  getQuickAuthToken,
  quickAuthFetch,
  openUrl,
  openMiniApp,
  inspectSDK,
};
