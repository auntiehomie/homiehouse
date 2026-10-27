/**
 * One-shot migration script to create the monetization tables.
 *
 * Tables:
 *  - hh2_purchases: records HH2 spend (shop purchases)
 *  - pro_subscribers: HomieHouse Pro tier subscriptions
 *  - sponsored_casts: sponsored cast inventory
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/migrate-monetization.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL (or POSTGRES_URL) environment variable is not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log('Running monetization migration…');

  // ── hh2_purchases ──────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS hh2_purchases (
      id SERIAL PRIMARY KEY,
      user_fid BIGINT NOT NULL,
      item_id TEXT NOT NULL,
      purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      tx_hash TEXT
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hh2_purchases_user_fid ON hh2_purchases(user_fid);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hh2_purchases_item_id ON hh2_purchases(item_id);`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_hh2_purchases_unique_item ON hh2_purchases(user_fid, item_id);`;
  console.log('  ✓ hh2_purchases');

  // ── pro_subscribers ───────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS pro_subscribers (
      id SERIAL PRIMARY KEY,
      user_fid BIGINT NOT NULL UNIQUE,
      stripe_customer_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_pro_subscribers_user_fid ON pro_subscribers(user_fid);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pro_subscribers_status ON pro_subscribers(status);`;
  console.log('  ✓ pro_subscribers');

  // ── sponsored_casts ───────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS sponsored_casts (
      id SERIAL PRIMARY KEY,
      sponsor_fid BIGINT NOT NULL,
      cast_hash TEXT NOT NULL,
      impression_count INTEGER NOT NULL DEFAULT 0,
      click_count INTEGER NOT NULL DEFAULT 0,
      budget_remaining DECIMAL(10, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sponsored_casts_active ON sponsored_casts(budget_remaining) WHERE budget_remaining > 0;`;
  console.log('  ✓ sponsored_casts');

  console.log('Migration complete.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
