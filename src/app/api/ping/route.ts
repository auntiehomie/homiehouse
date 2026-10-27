import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const host = req.headers.get("host") ?? "";
    return NextResponse.json({ ok: true, time: new Date().toISOString(), host });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
