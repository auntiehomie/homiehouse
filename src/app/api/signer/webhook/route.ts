import { NextRequest, NextResponse } from "next/server";

// Webhook endpoint for Neynar to notify us when signer is approved
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Signer webhook received:", body);
    
    // Just acknowledge receipt - the signer status will be checked by polling
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Webhook error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
