/**
 * Onboarding state storage — Neon DB-backed tracking for HomieHouse
 * user onboarding flow. Uses the same ensureTable pattern as
 * bot-reply-storage.ts for idempotent schema creation.
 */

import { getDb } from '@/lib/db';

// ── Types ────────────────────────────────────────────────────────────────────

export type OnboardingStage =
  | 'pending'
  | 'email_verified'
  | 'identity_ready'
  | 'profile_ready'
  | 'discovered'
  | 'composer_ready'
  | 'activated';

export interface UserRow {
  id: number;
  email: string;
  fid: number | null;
  username: string | null;
  display_name: string | null;
  pfp_url: string | null;
  bio: string | null;
  onboarding_stage: OnboardingStage;
  identity_mode: 'new' | 'existing_connected' | null;
  selected_interests: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingStateRow {
  user_id: number;
  stage: OnboardingStage;
  identity_mode: string | null;
  profile_completed_at: string | null;
  first_follow_at: string | null;
  signer_approved_at: string | null;
  first_cast_at: string | null;
  selected_interests: string[] | null;
  starter_pack_version: string | null;
  email_sequence_version: string | null;
  last_step: string | null;
  draft_cast: string | null;
  completed_at: string | null;
}

// ── Schema initialization ────────────────────────────────────────────────────

let _ensured = false;

async function ensureTables(): Promise<void> {
  if (_ensured) return;
  const db = getDb();

  const userStatements = [
    `CREATE TABLE IF NOT EXISTS users (
       id               SERIAL PRIMARY KEY,
       email            TEXT UNIQUE NOT NULL,
       fid              INTEGER,
       username         TEXT,
       display_name     TEXT,
       pfp_url          TEXT,
       bio              TEXT,
       onboarding_stage TEXT DEFAULT 'pending',
       identity_mode    TEXT,
       selected_interests TEXT[],
       created_at       TIMESTAMPTZ DEFAULT NOW(),
       updated_at       TIMESTAMPTZ DEFAULT NOW()
     )`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS fid               INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS username          TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name      TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS pfp_url           TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio               TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_stage  TEXT DEFAULT 'pending'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_mode     TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_interests TEXT[]`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW()`,
  ];

  for (const sql of userStatements) {
    try {
      await db.query(sql);
    } catch (err: any) {
      console.error('[onboarding-storage] users ensureTable statement failed:', err?.message);
    }
  }

  const tokenStatements = [
    `CREATE TABLE IF NOT EXISTS magic_link_tokens (
       id         SERIAL PRIMARY KEY,
       token      TEXT UNIQUE NOT NULL,
       email      TEXT NOT NULL,
       user_id    INTEGER REFERENCES users(id),
       expires_at TIMESTAMPTZ NOT NULL,
       used       BOOLEAN DEFAULT FALSE,
       created_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS user_id    INTEGER`,
  ];

  for (const sql of tokenStatements) {
    try {
      await db.query(sql);
    } catch (err: any) {
      console.error('[onboarding-storage] magic_link_tokens ensureTable statement failed:', err?.message);
    }
  }

  const onboardingStatements = [
    `CREATE TABLE IF NOT EXISTS onboarding_state (
       user_id               INTEGER PRIMARY KEY REFERENCES users(id),
       stage                 TEXT DEFAULT 'pending',
       identity_mode         TEXT,
       profile_completed_at  TIMESTAMPTZ,
       first_follow_at       TIMESTAMPTZ,
       signer_approved_at    TIMESTAMPTZ,
       first_cast_at         TIMESTAMPTZ,
       selected_interests    TEXT[],
       starter_pack_version  TEXT,
       email_sequence_version TEXT,
       last_step             TEXT,
       draft_cast            TEXT,
       completed_at          TIMESTAMPTZ
     )`,
    `ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS identity_mode           TEXT`,
    `ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS profile_completed_at    TIMESTAMPTZ`,
    `ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS first_follow_at         TIMESTAMPTZ`,
    `ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS signer_approved_at      TIMESTAMPTZ`,
    `ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS first_cast_at           TIMESTAMPTZ`,
    `ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS selected_interests      TEXT[]`,
    `ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS starter_pack_version    TEXT`,
    `ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS email_sequence_version  TEXT`,
    `ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS last_step               TEXT`,
    `ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS draft_cast              TEXT`,
    `ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS completed_at            TIMESTAMPTZ`,
  ];

  for (const sql of onboardingStatements) {
    try {
      await db.query(sql);
    } catch (err: any) {
      console.error('[onboarding-storage] onboarding_state ensureTable statement failed:', err?.message);
    }
  }

  _ensured = true;
}

// ── User operations ──────────────────────────────────────────────────────────

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  await ensureTables();
  const db = getDb();
  const { rows } = await db.query(
    `SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getUserById(userId: number): Promise<UserRow | null> {
  await ensureTables();
  const db = getDb();
  const { rows } = await db.query(
    `SELECT * FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function createOrUpdateUser(params: {
  email: string;
  onboarding_stage?: OnboardingStage;
  display_name?: string;
}): Promise<UserRow> {
  await ensureTables();
  const db = getDb();
  const { rows } = await db.query(
    `INSERT INTO users (email, onboarding_stage, display_name)
     VALUES (LOWER($1), $2, $3)
     ON CONFLICT (email) DO UPDATE SET
       updated_at = NOW()
     RETURNING *`,
    [params.email.toLowerCase(), params.onboarding_stage ?? 'pending', params.display_name ?? null]
  );
  return rows[0];
}

export async function updateUserStage(
  userId: number,
  stage: OnboardingStage
): Promise<UserRow | null> {
  await ensureTables();
  const db = getDb();
  const { rows } = await db.query(
    `UPDATE users SET onboarding_stage = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [stage, userId]
  );
  return rows.length > 0 ? rows[0] : null;
}

// ── Magic link token operations ──────────────────────────────────────────────

export async function createMagicLinkToken(
  token: string,
  email: string,
  userId: number,
  expiresAt: string
): Promise<void> {
  await ensureTables();
  const db = getDb();
  await db.query(
    `INSERT INTO magic_link_tokens (token, email, user_id, expires_at)
     VALUES ($1, LOWER($2), $3, $4)`,
    [token, email, userId, expiresAt]
  );
}

export async function verifyMagicLinkToken(
  token: string
): Promise<{ email: string; userId: number } | null> {
  await ensureTables();
  const db = getDb();
  const { rows } = await db.query(
    `SELECT token, email, user_id, expires_at, used FROM magic_link_tokens WHERE token = $1 LIMIT 1`,
    [token]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  if (row.used) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  // Mark as used
  await db.query(
    `UPDATE magic_link_tokens SET used = TRUE WHERE token = $1`,
    [token]
  );

  return { email: row.email, userId: row.user_id };
}

// ── Onboarding state operations ──────────────────────────────────────────────

export async function getOnboardingState(
  userId: number
): Promise<OnboardingStateRow | null> {
  await ensureTables();
  const db = getDb();
  const { rows } = await db.query(
    `SELECT * FROM onboarding_state WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function updateOnboardingStage(
  userId: number,
  stage: OnboardingStage
): Promise<OnboardingStateRow> {
  await ensureTables();
  const db = getDb();
  const { rows } = await db.query(
    `INSERT INTO onboarding_state (user_id, stage)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       stage = EXCLUDED.stage
     RETURNING *`,
    [userId, stage]
  );
  // Also update the users table
  await updateUserStage(userId, stage);
  return rows[0];
}

export async function setIdentityMode(
  userId: number,
  mode: 'new' | 'existing_connected'
): Promise<void> {
  await ensureTables();
  const db = getDb();
  await db.query(
    `INSERT INTO onboarding_state (user_id, identity_mode, stage)
     VALUES ($1, $2, 'identity_ready')
     ON CONFLICT (user_id) DO UPDATE SET
       identity_mode = EXCLUDED.identity_mode,
       stage = CASE
         WHEN onboarding_state.stage = 'pending' OR onboarding_state.stage = 'email_verified'
         THEN 'identity_ready'
         ELSE onboarding_state.stage
       END`,
    [userId, mode]
  );
  await db.query(
    `UPDATE users SET identity_mode = $1, onboarding_stage = 'identity_ready', updated_at = NOW()
     WHERE id = $2`,
    [mode, userId]
  );
}

export async function setProfileReady(
  userId: number,
  profileData: {
    display_name?: string;
    bio?: string;
    pfp_url?: string;
  }
): Promise<OnboardingStateRow> {
  await ensureTables();
  const db = getDb();

  // Update users table
  const updates: string[] = ['updated_at = NOW()'];
  const values: any[] = [];
  let paramIdx = 1;

  if (profileData.display_name) {
    updates.push(`display_name = $${paramIdx++}`);
    values.push(profileData.display_name);
  }
  if (profileData.bio) {
    updates.push(`bio = $${paramIdx++}`);
    values.push(profileData.bio);
  }
  if (profileData.pfp_url) {
    updates.push(`pfp_url = $${paramIdx++}`);
    values.push(profileData.pfp_url);
  }

  values.push(userId);
  await db.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
    values
  );

  // Update onboarding_state
  const { rows } = await db.query(
    `INSERT INTO onboarding_state (user_id, stage, profile_completed_at)
     VALUES ($1, 'profile_ready', NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       stage = CASE
         WHEN onboarding_state.stage IN ('pending', 'email_verified', 'identity_ready')
         THEN 'profile_ready'
         ELSE onboarding_state.stage
       END,
       profile_completed_at = COALESCE(onboarding_state.profile_completed_at, NOW())
     RETURNING *`,
    [userId]
  );

  await updateUserStage(userId, 'profile_ready');
  return rows[0];
}

export async function setDiscovered(
  userId: number,
  interests: string[],
  follows: string[]
): Promise<OnboardingStateRow> {
  await ensureTables();
  const db = getDb();

  await db.query(
    `UPDATE users SET selected_interests = $1, updated_at = NOW() WHERE id = $2`,
    [interests, userId]
  );

  const { rows } = await db.query(
    `INSERT INTO onboarding_state (user_id, stage, selected_interests, first_follow_at)
     VALUES ($1, 'discovered', $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       stage = CASE
         WHEN onboarding_state.stage IN ('pending', 'email_verified', 'identity_ready', 'profile_ready')
         THEN 'discovered'
         ELSE onboarding_state.stage
       END,
       selected_interests = EXCLUDED.selected_interests,
       first_follow_at = COALESCE(onboarding_state.first_follow_at, NOW())
     RETURNING *`,
    [userId, interests]
  );

  await updateUserStage(userId, 'discovered');
  return rows[0];
}

export async function setActivated(
  userId: number,
  firstCastHash: string
): Promise<OnboardingStateRow> {
  await ensureTables();
  const db = getDb();

  const { rows } = await db.query(
    `INSERT INTO onboarding_state (user_id, stage, first_cast_at, completed_at)
     VALUES ($1, 'activated', NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       stage = 'activated',
       first_cast_at = COALESCE(onboarding_state.first_cast_at, NOW()),
       completed_at = COALESCE(onboarding_state.completed_at, NOW())
     RETURNING *`,
    [userId]
  );

  await updateUserStage(userId, 'activated');
  return rows[0];
}