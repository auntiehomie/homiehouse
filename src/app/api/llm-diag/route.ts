import { NextRequest, NextResponse } from "next/server";
import { getLLMProviders } from "@/lib/llm";
import { verifyCronSecret } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";

export const maxDuration = 30;

export async function GET(_req: NextRequest) {
  // This endpoint bills a live completion to every configured provider, so it is
  // gated on the same secret the cron routes use rather than being open to all.
  try {
    verifyCronSecret(_req, process.env.CRON_SECRET);
  } catch (err) {
    return handleApiError(err, "GET /llm-diag");
  }

  const providers = getLLMProviders();
  const results: Record<string, string> = {
    configured: providers.map((p) => p.name).join(",") || "none",
  };

  // Test all providers in PARALLEL with 10s timeout each
  // Parallel so total wait = max 10s, not sum of all providers
  const tests = await Promise.all(
    providers.map(async (p) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await p.client.chat.completions.create(
          {
            model: p.model,
            messages: [{ role: "user", content: "Reply with exactly: OK" }],
            max_tokens: 10,
          },
          { signal: controller.signal },
        );
        clearTimeout(timer);
        return [
          p.name,
          `OK: ${response.choices[0]?.message?.content?.trim()}`,
        ] as const;
      } catch (err: any) {
        clearTimeout(timer);
        // Upstream error text can carry key fragments and infra detail — log it
        // server-side, return only the outcome.
        console.error(`[llm-diag] ${p.name} failed:`, err?.message);
        return [p.name, "FAIL"] as const;
      }
    }),
  );

  for (const [name, status] of tests) {
    results[name] = status;
  }

  return NextResponse.json(results);
}
