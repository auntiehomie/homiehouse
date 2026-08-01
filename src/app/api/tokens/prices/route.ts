import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { getTokenPrices } from '@/lib/token-data';

/**
 * POST /api/tokens/prices
 * Get prices for multiple tokens at once
 * 
 * Body: { addresses: string[] }
 */
export async function POST(request: NextRequest) {
  try {

    // Rate limit: 30 requests/minute per IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { success: rateLimitOk } = rateLimit(`tokens-prices:${ip}`, 30, 60);
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    const { addresses } = await request.json();

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { error: 'addresses array is required' },
        { status: 400 }
      );
    }

    if (addresses.length === 0) {
      return NextResponse.json(
        { error: 'At least one address is required' },
        { status: 400 }
      );
    }

    if (addresses.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 addresses allowed per request' },
        { status: 400 }
      );
    }

    const prices = await getTokenPrices(addresses);

    return NextResponse.json({
      success: true,
      count: Object.keys(prices).length,
      prices,
    });
  } catch (error) {
    console.error('Token prices error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token prices' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tokens/prices?addresses=0x....,0x....
 * Get prices for multiple tokens (alternative GET endpoint)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const addressesParam = searchParams.get('addresses');

    if (!addressesParam) {
      return NextResponse.json(
        { error: 'addresses parameter is required (comma-separated)' },
        { status: 400 }
      );
    }

    const addresses = addressesParam.split(',').map(a => a.trim()).filter(a => a);

    if (addresses.length === 0) {
      return NextResponse.json(
        { error: 'At least one address is required' },
        { status: 400 }
      );
    }

    if (addresses.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 addresses allowed per request' },
        { status: 400 }
      );
    }

    const prices = await getTokenPrices(addresses);

    return NextResponse.json({
      success: true,
      count: Object.keys(prices).length,
      prices,
    });
  } catch (error) {
    console.error('Token prices error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token prices' },
      { status: 500 }
    );
  }
}
