import { NextResponse } from 'next/server';

// GET /api/stripe/checkout — placeholder Stripe checkout redirect
// Replace with actual Stripe Checkout Session creation when Stripe is integrated.
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: 'Stripe integration is coming soon.',
      message: 'HomieHouse Pro billing will be available shortly. Check back soon!',
    },
    { status: 501 }
  );
}