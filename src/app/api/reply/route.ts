import { NextRequest, NextResponse } from "next/server";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

const config = new Configuration({
  apiKey: NEYNAR_API_KEY,
});

const neynarClient = new NeynarAPIClient(config);

export async function POST(req: NextRequest) {
  try {
    const { text, signerUuid, parentHash } = await req.json();

    if (!NEYNAR_API_KEY) {
      return NextResponse.json({ ok: false, error: "NEYNAR_API_KEY not configured" }, { status: 500 });
    }

    if (!text || !signerUuid || !parentHash) {
      return NextResponse.json({ ok: false, error: "Missing text, signerUuid, or parentHash" }, { status: 400 });
    }

    // Post reply using Neynar SDK
    const response = await neynarClient.publishCast({
      signerUuid,
      text,
      parent: parentHash, // This makes it a reply
    });

    return NextResponse.json({ ok: true, cast: response });
  } catch (error: any) {
    console.error("Reply error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
