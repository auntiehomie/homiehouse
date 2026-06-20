"use client";

import { useEffect } from "react";

export default function SdkDevMock() {
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const host = window.location.hostname;
      // Only enable mock on localhost to avoid interfering with real hosts
      if (host !== "localhost" && host !== "127.0.0.1") return;
      if ((window as any).sdk) {
        console.log("window.sdk already present, skipping dev mock");
        return;
      }

      const mock = {
        actions: {
          composeCast: async ({ text }: { text: string }) => {
            console.log("[sdk-mock] composeCast", text);
            // simulate async delay
            await new Promise((r) => setTimeout(r, 200));
            return { ok: true };
          },
          openUrl: (url: string) => window.open(url, "_blank"),
        },
        getCapabilities: () => ["composeCast", "wallet.getEthereumProvider"],
        quickAuth: {
          getToken: async () => {
            await new Promise((r) => setTimeout(r, 50));
            return "mock-quick-auth-token";
          },
          fetch: (input: RequestInfo, init?: RequestInit) => fetch(input, init),
        },
        api: {
          feed: {
            getHome: async ({ limit }: { limit: number }) => {
              // return some mocked casts
              return [
                { id: '1', author: 'alice', text: 'Hello from Alice!', timestamp: '2025-12-15 10:00' },
                { id: '2', author: 'bob', text: 'Bob says hi 👋', timestamp: '2025-12-15 09:45' },
              ];
            },
            getTrending: async ({ limit }: { limit: number }) => {
              return [
                { id: 't1', author: 'carol', text: 'Trending: check this out!', ts: '2025-12-14' },
                { id: 't2', author: 'dave', text: 'This is on fire 🔥', ts: '2025-12-13' },
              ];
            },
          },
        },
        invoke: async (name: string, args?: any) => {
          console.log("[sdk-mock] invoke", name, args);
          return { ok: true };
        },
        isInMiniApp: () => false,
      } as any;

      (window as any).sdk = mock;
      console.log("[sdk-mock] injected mock sdk for local dev");
    } catch (e) {
      // swallow
    }
  }, []);

  return null;
}
