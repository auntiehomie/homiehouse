import { NextRequest } from 'next/server';
import { POST as checkout } from '@/app/api/stripe/checkout/route';
import { POST as portal } from '@/app/api/stripe/portal/route';
import { getStripeOrThrow, getProSubscriber } from '@/lib/stripe';
import { verifySession } from '@/lib/session';

jest.mock('@noble/ed25519', () => ({
  getPublicKeyAsync: jest.fn(async () => Uint8Array.from({ length: 32 }, () => 2)),
}));
jest.mock('@/lib/db', () => ({ sql: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/session', () => ({ verifySession: jest.fn(), SessionError: class extends Error {} }));
jest.mock('@/lib/stripe', () => ({
  PRO_PRICE_ID: 'price_pro_four_dollars',
  getStripeOrThrow: jest.fn(),
  getProSubscriber: jest.fn(),
}));

describe('Stripe routes with scoped session authentication', () => {
  const createCheckout = jest.fn();
  const createPortal = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ signer: { fid: 123, key: '02'.repeat(32), keyType: 1, source: 'SIGNER_SOURCE_OFFCHAIN' } }),
    });
    (getStripeOrThrow as jest.Mock).mockReturnValue({
      checkout: { sessions: { create: createCheckout } },
      billingPortal: { sessions: { create: createPortal } },
    });
    createCheckout.mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com/test' });
    createPortal.mockResolvedValue({ url: 'https://billing.stripe.com/test' });
    (getProSubscriber as jest.Mock).mockResolvedValue({ stripe_customer_id: 'cus_123' });
    (verifySession as jest.Mock).mockResolvedValue({ fid: 123, scopes: ['write:shop'] });
  });

  function request(path: string, authenticated = true) {
    return new NextRequest(`https://homiehouse.app/api/stripe/${path}`, {
      method: 'POST',
      headers: authenticated ? { 'x-session-token': 'valid-session' } : {},
    });
  }

  it('starts checkout and binds billing to the session FID', async () => {
    const response = await checkout(request('checkout'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, url: 'https://checkout.stripe.com/test' });
    expect(createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'subscription',
      metadata: { fid: '123' },
      subscription_data: { metadata: { fid: '123' } },
      line_items: [{ price: 'price_pro_four_dollars', quantity: 1 }],
    }));
  });

  it('opens the billing portal for the verified subscriber', async () => {
    const response = await portal(request('portal'));
    expect(response.status).toBe(200);
    expect(getProSubscriber).toHaveBeenCalledWith(123);
    expect(createPortal).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_123' }));
  });

  it.each([['checkout', checkout], ['portal', portal]] as const)('rejects a missing session before calling Stripe (%s)', async (path, handler) => {
    const response = await handler(request(path, false));
    expect(response.status).toBe(401);
    expect(getStripeOrThrow).not.toHaveBeenCalled();
    expect(getProSubscriber).not.toHaveBeenCalled();
  });
});
