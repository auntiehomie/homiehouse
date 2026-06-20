"use client";

import React, { useEffect, useState } from "react";
import farcaster from "../../lib/farcaster";

export default function DevPage() {
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    const inspected = farcaster.inspectSDK();
    setInfo(inspected);
  }, []);

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-black text-black dark:text-white">
      <main className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold mb-4">Dev — SDK Inspector</h1>
        <pre className="whitespace-pre-wrap rounded border p-4 bg-white text-sm text-black dark:bg-[#111]">
          {JSON.stringify(info, null, 2)}
        </pre>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Use this view inside a Farcaster host (or the preview tool) to see what runtime actions and
          surfaces are available.
        </p>
      </main>
    </div>
  );
}
