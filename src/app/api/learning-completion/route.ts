import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';

const REWARD_PER_MODULE = 100;
const MAX_REWARDED_MODULES_PER_FID = 50;
const MIN_ATTEMPT_SECONDS = 45;

export async function POST(req: NextRequest) {
  let fid: number;
  try {
    fid = await verifyFarcasterSignerAuth(req);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }

  let body: { moduleId?: unknown; answers?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
  const moduleId = typeof body.moduleId === 'string' ? body.moduleId : '';
  const answers = body.answers;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(moduleId) || !Array.isArray(answers)) {
    return NextResponse.json({ ok: false, error: 'Invalid module completion' }, { status: 400 });
  }

  const db = getDb();
  const client = await db.connect();
  const fail = async (status: number, error: string) => {
    await client.query('ROLLBACK');
    return NextResponse.json({ ok: false, error }, { status });
  };

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [fid]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS learning_reward_plans (
        fid INTEGER PRIMARY KEY, plan JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS learning_reward_attempts (
        fid INTEGER NOT NULL, module_id TEXT NOT NULL, quiz_key JSONB NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ,
        PRIMARY KEY (fid, module_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS hh2_reward_events (
        fid INTEGER NOT NULL, module_id TEXT NOT NULL,
        amount INTEGER NOT NULL CHECK (amount = 100),
        status TEXT NOT NULL DEFAULT 'earned' CHECK (status IN ('earned', 'pending', 'claimed')),
        wallet_address TEXT, claim_tx_hash TEXT,
        earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), claimed_at TIMESTAMPTZ,
        PRIMARY KEY (fid, module_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS hh2_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fid INTEGER NOT NULL,
        module_id TEXT NOT NULL, wallet_address TEXT NOT NULL, tx_hash TEXT NOT NULL,
        amount INTEGER NOT NULL, claimed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(fid, module_id)
      )
    `);

    const planRows = await client.query(
      'SELECT plan FROM learning_reward_plans WHERE fid = $1 FOR UPDATE', [fid]
    );
    const assignedModules = planRows.rows[0]?.plan?.modules;
    if (!Array.isArray(assignedModules) || !assignedModules.some((m: any) => m?.id === moduleId)) {
      return await fail(403, 'This module is not in your server-issued learning plan.');
    }

    const attemptRows = await client.query(
      'SELECT quiz_key, started_at, completed_at FROM learning_reward_attempts WHERE fid = $1 AND module_id = $2 FOR UPDATE',
      [fid, moduleId]
    );
    if (attemptRows.rows.length === 0) {
      return await fail(400, 'Open this lesson while signed in before submitting its completion.');
    }
    const attempt = attemptRows.rows[0];
    if (attempt.completed_at) {
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, alreadyCompleted: true, amount: REWARD_PER_MODULE });
    }
    const elapsedSeconds = (Date.now() - new Date(attempt.started_at).getTime()) / 1000;
    if (elapsedSeconds < MIN_ATTEMPT_SECONDS) {
      return await fail(400, 'Keep the lesson open for at least 45 seconds before completing it.');
    }

    const quiz = attempt.quiz_key;
    if (!Array.isArray(quiz) || quiz.length === 0 || answers.length !== quiz.length) {
      return await fail(400, 'The submitted quiz does not match this lesson.');
    }
    let correct = 0;
    for (let i = 0; i < quiz.length; i++) {
      const answer = answers[i];
      if (!Number.isInteger(answer) || answer < 0 || answer >= quiz[i].options?.length) {
        return await fail(400, 'Invalid quiz answer.');
      }
      if (answer === quiz[i].correctIndex) correct++;
    }
    if (correct / quiz.length < 0.75) {
      return await fail(400, 'Pass at least 75% of the lesson quiz to earn HH2.');
    }

    const priorClaim = await client.query(
      'SELECT 1 FROM hh2_claims WHERE fid = $1 AND module_id = $2 LIMIT 1',
      [fid, moduleId]
    );
    if (priorClaim.rows.length > 0) {
      await client.query(
        'UPDATE learning_reward_attempts SET completed_at = NOW() WHERE fid = $1 AND module_id = $2',
        [fid, moduleId]
      );
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, alreadyClaimed: true, amount: 0 });
    }

    const earnedRows = await client.query(
      'SELECT COUNT(*)::int AS count FROM hh2_reward_events WHERE fid = $1',
      [fid]
    );
    if (earnedRows.rows[0].count >= MAX_REWARDED_MODULES_PER_FID) {
      return await fail(403, 'You have reached the lifetime HH2 learning reward limit.');
    }

    const insert = await client.query(
      'INSERT INTO hh2_reward_events (fid, module_id, amount) VALUES ($1, $2, $3) ON CONFLICT (fid, module_id) DO NOTHING RETURNING module_id',
      [fid, moduleId, REWARD_PER_MODULE]
    );
    await client.query(
      'UPDATE learning_reward_attempts SET completed_at = NOW() WHERE fid = $1 AND module_id = $2',
      [fid, moduleId]
    );
    await client.query('COMMIT');

    return NextResponse.json({
      ok: true,
      alreadyCompleted: insert.rows.length === 0,
      amount: insert.rows.length ? REWARD_PER_MODULE : 0,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[learning-completion] error:', error);
    return NextResponse.json({ ok: false, error: 'Could not record lesson completion' }, { status: 500 });
  } finally {
    client.release();
  }
}
