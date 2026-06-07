import { NextRequest, NextResponse } from 'next/server';

// In-memory store — resets on cold start, sufficient for social proof UX
const learners = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const { fid } = await req.json();
    if (fid) learners.add(String(fid));
  } catch {}
  return NextResponse.json({ count: learners.size });
}

export async function GET() {
  return NextResponse.json({ count: learners.size });
}
