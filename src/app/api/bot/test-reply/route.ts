import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ error: 'Bot test reply endpoint retired' }, { status: 410 });
}
