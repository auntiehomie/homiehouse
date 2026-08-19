/**
 * Email client — Resend integration for magic link auth, welcome emails,
 * onboarding nudges, and security alerts.
 *
 * All emails sent from homie@homiehouse.lol.
 */

import { Resend } from 'resend';

// ── Resend client (lazy-initialized) ─────────────────────────────────────────

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

// ── Constants ────────────────────────────────────────────────────────────────

const FROM_ADDRESS = 'homie@homiehouse.lol';
const FROM_ONBOARDING = 'onboarding@homiehouse.lol';
const PREFERENCES_URL = 'https://homiehouse.lol/email-preferences';
const BASE_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #111; color: #fff; margin: 0; padding: 0; }
  .container { max-width: 480px; margin: 0 auto; padding: 40px 20px; }
  .logo { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 24px; }
  .card { background: #1C1C1C; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 32px; }
  h1 { font-size: 20px; font-weight: 600; margin: 0 0 12px; color: #fff; }
  p { font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.75); margin: 0 0 16px; }
  .button { display: inline-block; background: linear-gradient(180deg, #334155 0%, #1e293b 100%); color: #e2e8f0; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; border: 1px solid rgba(255,255,255,0.1); }
  .button:hover { background: linear-gradient(180deg, #475569 0%, #334155 100%); }
  .link { color: rgba(255,255,255,0.5); font-size: 12px; }
  .code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #fff; background: rgba(255,255,255,0.05); padding: 16px 24px; border-radius: 8px; display: inline-block; margin: 16px 0; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
  .footer p { font-size: 12px; color: rgba(255,255,255,0.4); margin: 0 0 8px; }
  .footer a { color: rgba(255,255,255,0.5); }
  .alert { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 16px; margin: 16px 0; }
  .stage-badge { display: inline-block; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 4px 12px; font-size: 12px; color: rgba(255,255,255,0.6); }
`;

function baseTemplate(children: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE_STYLES}</style></head><body><div class="container"><div class="logo">🏠 HomieHouse</div>${children}<div class="footer"><p>HomieHouse — a home on Farcaster</p><p><a href="${PREFERENCES_URL}">Email preferences</a> · <a href="${PREFERENCES_URL}?unsubscribe">Unsubscribe</a></p></div></div></body></html>`;
}

// ── Public email functions ───────────────────────────────────────────────────

export async function sendMagicLinkEmail(
  email: string,
  token: string,
  baseUrl: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const verifyUrl = `${baseUrl}/auth/verify?token=${token}`;

  const html = baseTemplate(`
    <div class="card">
      <h1>Sign in to HomieHouse</h1>
      <p>Click the button below to sign in. This link expires in 15 minutes and can only be used once.</p>
      <a href="${escapeHtml(verifyUrl)}" class="button">Sign in to HomieHouse</a>
      <p style="margin-top: 24px; font-size: 13px; color: rgba(255,255,255,0.5);">If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="font-size: 12px; color: rgba(255,255,255,0.4); word-break: break-all;">${escapeHtml(verifyUrl)}</p>
      <p style="margin-top: 24px; font-size: 13px; color: rgba(255,255,255,0.35);">This link was requested for <strong>${escapeHtml(email)}</strong>. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `);

  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [email],
      subject: 'Sign in to HomieHouse',
      html,
    });
    // resend returns { data, error } — error is null on success
    if (result.error) {
      console.error('[email] sendMagicLinkEmail error:', result.error);
      return { ok: false, error: result.error.message || 'Failed to send email' };
    }
    return { ok: true, id: result.data?.id };
  } catch (err: any) {
    console.error('[email] sendMagicLinkEmail exception:', err?.message);
    return { ok: false, error: err?.message || 'Failed to send email' };
  }
}

export async function sendWelcomeEmail(
  email: string,
  displayName: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const name = displayName || email;
  const html = baseTemplate(`
    <div class="card">
      <h1>Welcome to HomieHouse, ${escapeHtml(name)}!</h1>
      <p>You're all set up and ready to explore Farcaster from your new home.</p>
      <p><strong>Here's what you can do:</strong></p>
      <ul style="color: rgba(255,255,255,0.75); font-size: 14px; line-height: 1.8; padding-left: 20px;">
        <li>Set up your profile</li>
        <li>Discover channels and people to follow</li>
        <li>Compose and share your first cast</li>
      </ul>
      <a href="https://homiehouse.lol/onboarding" class="button">Continue Setup</a>
    </div>
  `);

  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: FROM_ONBOARDING,
      to: [email],
      subject: 'Welcome to HomieHouse 🏠',
      html,
    });
    if (result.error) {
      console.error('[email] sendWelcomeEmail error:', result.error);
      return { ok: false, error: result.error.message || 'Failed to send email' };
    }
    return { ok: true, id: result.data?.id };
  } catch (err: any) {
    console.error('[email] sendWelcomeEmail exception:', err?.message);
    return { ok: false, error: err?.message || 'Failed to send email' };
  }
}

const ONBOARDING_STAGE_LABELS: Record<string, string> = {
  pending: 'Your account is created but you haven\'t verified your email yet.',
  email_verified: 'You\'ve verified your email — next step: set up your Farcaster identity.',
  identity_ready: 'Your identity is ready — time to build your profile.',
  profile_ready: 'Profile complete! Discover channels and people to follow.',
  discovered: 'You\'ve found your people — ready to compose your first cast?',
  composer_ready: 'The composer is ready — share your first cast!',
  activated: 'You\'re fully activated on HomieHouse!',
};

const ONBOARDING_STAGE_CTA: Record<string, { text: string; url: string }> = {
  pending: { text: 'Verify your email', url: '' },
  email_verified: { text: 'Set up your identity', url: '/onboarding' },
  identity_ready: { text: 'Complete your profile', url: '/onboarding' },
  profile_ready: { text: 'Discover your feed', url: '/onboarding' },
  discovered: { text: 'Compose your first cast', url: '/onboarding' },
  composer_ready: { text: 'Check out your feed', url: '/feed' },
  activated: { text: 'Go to your feed', url: '/feed' },
};

export async function sendOnboardingNudge(
  email: string,
  stage: string,
  baseUrl: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const description = ONBOARDING_STAGE_LABELS[stage] || 'Continue your HomieHouse onboarding.';
  const cta = ONBOARDING_STAGE_CTA[stage] || { text: 'Continue Setup', url: '/onboarding' };
  const ctaUrl = cta.url.startsWith('http') ? cta.url : `${baseUrl}${cta.url}`;

  const html = baseTemplate(`
    <div class="card">
      <h1>Your HomieHouse setup is waiting</h1>
      <p>${escapeHtml(description)}</p>
      <p><span class="stage-badge">Stage: ${escapeHtml(stage)}</span></p>
      <a href="${escapeHtml(ctaUrl)}" class="button">${escapeHtml(cta.text)}</a>
    </div>
  `);

  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: FROM_ONBOARDING,
      to: [email],
      subject: 'Finish setting up your HomieHouse 🏠',
      html,
    });
    if (result.error) {
      console.error('[email] sendOnboardingNudge error:', result.error);
      return { ok: false, error: result.error.message || 'Failed to send email' };
    }
    return { ok: true, id: result.data?.id };
  } catch (err: any) {
    console.error('[email] sendOnboardingNudge exception:', err?.message);
    return { ok: false, error: err?.message || 'Failed to send email' };
  }
}

export async function sendSecurityAlert(
  email: string,
  event: string,
  details: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const html = baseTemplate(`
    <div class="card">
      <h1>🔒 Security Alert</h1>
      <div class="alert">
        <p style="color: rgba(239, 68, 68, 0.9); margin: 0;"><strong>${escapeHtml(event)}</strong></p>
      </div>
      <p>${escapeHtml(details)}</p>
      <p style="font-size: 13px; color: rgba(255,255,255,0.35);">If this wasn't you, please secure your account immediately. You can reply to this email for help.</p>
    </div>
  `);

  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [email],
      subject: `Security Alert: ${event}`,
      html,
    });
    if (result.error) {
      console.error('[email] sendSecurityAlert error:', result.error);
      return { ok: false, error: result.error.message || 'Failed to send email' };
    }
    return { ok: true, id: result.data?.id };
  } catch (err: any) {
    console.error('[email] sendSecurityAlert exception:', err?.message);
    return { ok: false, error: err?.message || 'Failed to send email' };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}