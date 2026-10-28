import { NextRequest, NextResponse } from 'next/server';
import { getTokenData, formatTokenDisplay } from '@/lib/token-data';

/**
 * GET /api/tokens/[identifier]
 * Get detailed token information by symbol, name, or contract address
 * 
 * Examples:
 * - /api/tokens/ethereum
 * - /api/tokens/ETH
 * - /api/tokens/0x4200000000000000000000000000000000000006
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params;

    if (!identifier) {
      return NextResponse.json(
        { error: 'Token identifier is required' },
        { status: 400 }
      );
    }

    const tokenData = await getTokenData(identifier);

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      token: tokenData,
      formatted: formatTokenDisplay(tokenData),
    });
  } catch (error) {
    console.error('Token info error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token information' },
      { status: 500 }
    );
  }
}
