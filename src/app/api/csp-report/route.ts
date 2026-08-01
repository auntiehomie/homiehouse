import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/csp-report — CSP violation report collector.
 *
 * Browsers POST a JSON body here whenever a Content-Security-Policy
 * (or -Report-Only) directive is violated. The report includes the
 * blocked resource URI, the violated directive, and the document URI.
 *
 * Before flipping from report-only to enforced CSP, check these reports
 * for false positives (especially from third-party wallet/auth SDKs).
 *
 * This endpoint logs violations so they can be reviewed; it does not
 * store them in the database to keep the collection lightweight.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const report = body?.["csp-report"] ?? body ?? {};

    // Structured log for grep / log-aggregator consumption
    console.log(
      JSON.stringify({
        type: "csp-violation",
        timestamp: new Date().toISOString(),
        "blocked-uri": report["blocked-uri"] || "",
        "document-uri": report["document-uri"] || "",
        "violated-directive": report["violated-directive"] || "",
        "original-policy": (report["original-policy"] || "").slice(0, 300),
        "source-file": report["source-file"] || "",
        "script-sample": report["script-sample"] || "",
      }),
    );

    return NextResponse.json({ ok: true }, { status: 204 });
  } catch {
    return NextResponse.json({ ok: true }, { status: 204 });
  }
}

/** GET returns a simple status for connectivity checks. */
export function GET() {
  return NextResponse.json({
    endpoint: "/api/csp-report",
    status: "active",
    description:
      "CSP violation report collector. POST only for actual reports.",
  });
}