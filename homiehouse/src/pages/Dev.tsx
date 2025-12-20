import { useState } from "react";
import { inspectSDK, ready } from "../lib/farcaster";

export default function Dev() {
  const [info, setInfo] = useState<{ actions: string[]; api: string[]; invoke: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleInspect() {
    setError(null);
    try {
      await ready();
      const got = inspectSDK();
      setInfo(got as any);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  }

  return (
    <section>
      <h2>Dev / SDK Inspector</h2>
      <p>Use this page to inspect the Farcaster `sdk` available in the frame environment.</p>
      <div>
        <button onClick={handleInspect}>Inspect SDK</button>
      </div>
      {error && <div style={{ color: "red" }}>Error: {error}</div>}
      {info && (
        <div style={{ marginTop: 12 }}>
          <div><strong>actions:</strong> {info.actions.join(", ") || "(none)"}</div>
          <div><strong>api:</strong> {info.api.join(", ") || "(none)"}</div>
          <div><strong>invoke:</strong> {info.invoke}</div>
        </div>
      )}
      <p style={{ marginTop: 12 }}>
        If you see specific method names here (for example `createCast`), tell me and I will update the
        integration to call them directly for posting and fetching.
      </p>
    </section>
  );
}
