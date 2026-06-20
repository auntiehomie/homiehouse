import { sdk } from "@farcaster/frame-sdk";

export type Cast = {
  id?: string;
  text: string;
  author?: string;
  timestamp?: string;
};

export async function ready() {
  try {
    await sdk.actions.ready();
    // log SDK shape to help debug integration at runtime
    try {
      // eslint-disable-next-line no-console
      console.log("[farcaster] sdk:", sdk);
      // eslint-disable-next-line no-console
      console.log("[farcaster] sdk.actions:", Object.keys((sdk as any).actions || {}));
      // eslint-disable-next-line no-console
      console.log("[farcaster] sdk.api:", Object.keys((sdk as any).api || {}));
      // eslint-disable-next-line no-console
      console.log("[farcaster] sdk.invoke:", typeof (sdk as any).invoke);
    } catch (e) {
      /* ignore logging errors */
    }
  } catch (err) {
    console.warn("Farcaster sdk ready() failed", err);
  }
}

export async function postCast(text: string) {
  // feature-detect common action names and call if available
  try {
    // Prefer the miniapp `composeCast` action (observed in the frame environment)
    if ((sdk as any).actions?.composeCast) {
      // Try several common payload shapes to be compatible across SDK versions
      const shapes = [
        { text },
        { body: text },
        { content: { text } },
        { content: { body: text } },
        { cast: text },
      ];

      for (const payload of shapes) {
        try {
          const res = await (sdk as any).actions.composeCast(payload);
          return res;
        } catch (_) {
          // try next shape
        }
      }
      // If none of the shapes worked, attempt a raw call with the text
      return await (sdk as any).actions.composeCast({ text });
    }

    // Backwards-compatible fallbacks
    if ((sdk as any).actions?.createCast) {
      return await (sdk as any).actions.createCast({ text });
    }

    if ((sdk as any).actions?.publish) {
      return await (sdk as any).actions.publish({ text });
    }

    if ((sdk as any).actions?.post) {
      return await (sdk as any).actions.post({ text });
    }

    // last-resort: attempt a generic `invoke` if present
    if ((sdk as any).invoke) {
      return await (sdk as any).invoke("createCast", { text });
    }

    throw new Error("No known publish API on Farcaster SDK in this environment");
  } catch (err) {
    console.error("postCast error", err);
    throw err;
  }
}

export async function fetchFeed(limit = 20): Promise<Cast[]> {
  try {
    // attempt to use a hypothetical `getFeed` API
    if ((sdk as any).api?.getFeed) {
      const res = await (sdk as any).api.getFeed({ limit });
      return Array.isArray(res) ? res : [];
    }

    // Some SDKs expose `getTimeline` or `getCasts` — try common alternatives
    if ((sdk as any).api?.getTimeline) {
      const res = await (sdk as any).api.getTimeline({ limit });
      return Array.isArray(res) ? res : [];
    }
    if ((sdk as any).api?.getCasts) {
      const res = await (sdk as any).api.getCasts({ limit });
      return Array.isArray(res) ? res : [];
    }

    // In the miniapp/frame environment there's no `api` surface exposed for reading
    // the global feed. Return an empty array and let the UI show a placeholder.
    // Optionally, a miniapp could open the native feed view via `openMiniApp`.
    return [];
  } catch (err) {
    console.error("fetchFeed error", err);
    return [];
  }
}

export function inspectSDK() {
  try {
    const actions = Object.keys((sdk as any).actions || {});
    const api = Object.keys((sdk as any).api || {});
    const invoke = typeof (sdk as any).invoke;
    return { actions, api, invoke };
  } catch (err) {
    return { actions: [], api: [], invoke: "unknown" };
  }
}

export async function getCapabilities(): Promise<string[]> {
  try {
    if ((sdk as any).getCapabilities) {
      return (await (sdk as any).getCapabilities()) || [];
    }
    return [];
  } catch (err) {
    console.warn("getCapabilities failed", err);
    return [];
  }
}

export async function isInMiniApp(timeoutMs = 100): Promise<boolean> {
  try {
    if ((sdk as any).isInMiniApp) {
      return await (sdk as any).isInMiniApp(timeoutMs);
    }
    // best-effort: if sdk.actions exists assume mini app
    return !!(sdk as any).actions;
  } catch (err) {
    return false;
  }
}

export async function openUrl(url: string) {
  try {
    if ((sdk as any).actions?.openUrl) {
      // accept string or object shapes
      return await (sdk as any).actions.openUrl(typeof url === 'string' ? { url } : url);
    }
    if ((sdk as any).actions?.openMiniApp) {
      // try opening as a miniapp launch if openUrl not available
      return await (sdk as any).actions.openMiniApp({ url });
    }
    console.warn('openUrl/openMiniApp not supported by host');
  } catch (err) {
    console.error('openUrl failed', err);
    throw err;
  }
}

export async function openMiniApp(url: string) {
  try {
    if ((sdk as any).actions?.openMiniApp) {
      return await (sdk as any).actions.openMiniApp({ url });
    }
    // fallback to openUrl
    return await openUrl(url);
  } catch (err) {
    console.error('openMiniApp failed', err);
    throw err;
  }
}

// Quick Auth helpers
export async function getQuickAuthToken(): Promise<string | undefined> {
  try {
    if ((sdk as any).quickAuth?.getToken) {
      const res = await (sdk as any).quickAuth.getToken();
      return res?.token;
    }
    console.warn('quickAuth.getToken not available in this host');
    return undefined;
  } catch (err) {
    console.error('getQuickAuthToken failed', err);
    return undefined;
  }
}

export async function quickAuthFetch(input: RequestInfo, init?: RequestInit) {
  try {
    if ((sdk as any).quickAuth?.fetch) {
      return await (sdk as any).quickAuth.fetch(input, init);
    }
    // Fallback: try to get token and call fetch with Authorization header
    const token = await getQuickAuthToken();
    const headers = new Headers(init?.headers || {});
    if (token) headers.set('Authorization', 'Bearer ' + token);
    return await fetch(input, { ...(init || {}), headers });
  } catch (err) {
    console.error('quickAuthFetch failed', err);
    throw err;
  }
}
