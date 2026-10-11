import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { rateLimit } from '@/lib/ratelimit';
import { getEarningsMultiplier, ensureStakingTables } from '@/app/api/hh2-stake/route';

/**
 * Daily Challenge — an extra earning opportunity beyond learning modules.
 *
 * Each day, users can answer a quick crypto/web3 trivia question for 50 HH2.
 * Stakers get boosted rewards (multiplier applied).
 * Resets daily at UTC midnight.
 */

const DAILY_CHALLENGE_REWARD = 50;

// Rotating set of daily challenge questions — web3/crypto education focused
const CHALLENGE_QUESTIONS = [
  {
    question: 'What does "impermanent loss" mean in DeFi liquidity pools?',
    options: [
      'Temporary loss of tokens from a smart contract bug',
      'The difference in value between holding tokens vs. providing them as liquidity',
      'Losing your private keys temporarily',
      'A temporary reduction in gas fees',
    ],
    correctIndex: 1,
    explanation: 'Impermanent loss occurs when the value of your deposited tokens changes relative to just holding them, due to price movement of the paired assets.',
  },
  {
    question: 'What is a "rug pull" in crypto?',
    options: [
      'A type of wallet backup',
      'When developers abandon a project and withdraw all liquidity, leaving investors with worthless tokens',
      'A fast withdrawal from an exchange',
      'A type of staking penalty',
    ],
    correctIndex: 1,
    explanation: 'A rug pull is a malicious act where project creators drain liquidity or abandon the project, leaving token holders with worthless assets.',
  },
  {
    question: 'What does "TVL" stand for in DeFi?',
    options: [
      'Token Verification Level',
      'Total Value Locked',
      'Token Vesting Limit',
      'Trading Volume Limit',
    ],
    correctIndex: 1,
    explanation: 'TVL (Total Value Locked) measures the total amount of assets deposited in a DeFi protocol, indicating its size and user trust.',
  },
  {
    question: 'What is the purpose of a "nonce" in Ethereum transactions?',
    options: [
      'A secret password for wallets',
      'A unique number that prevents transaction replay and ensures ordering',
      'A type of gas fee',
      'A network congestion indicator',
    ],
    correctIndex: 1,
    explanation: 'Each account has a nonce that increments per transaction, preventing replay attacks and ensuring transactions process in order.',
  },
  {
    question: 'What is "slippage" when swapping tokens on a DEX?',
    options: [
      'The difference between expected and actual execution price due to price movement during the transaction',
      'Losing tokens during a transfer',
      'A fee charged by the DEX',
      'When a transaction fails and tokens are returned',
    ],
    correctIndex: 0,
    explanation: 'Slippage is the price change between when you submit a swap and when it executes. High slippage means you get a worse price than expected.',
  },
  {
    question: 'What is a "yield curve" in traditional finance?',
    options: [
      'A graph showing token yields over time',
      'A graph showing interest rates across different bond maturities',
      'A DeFi staking strategy',
      'A type of crypto market indicator',
    ],
    correctIndex: 1,
    explanation: 'A yield curve plots interest rates of bonds with different maturity dates. An inverted yield curve can signal a recession.',
  },
  {
    question: 'What does "APR" vs "APY" difference mean for your savings?',
    options: [
      'APR includes compounding, APY does not',
      'APY includes compounding interest, APR does not',
      'They are the same thing',
      'APR is for crypto, APY is for banks',
    ],
    correctIndex: 1,
    explanation: 'APY (Annual Percentage Yield) accounts for compounding interest, while APR (Annual Percentage Rate) is the simple interest rate without compounding.',
  },
];

async function ensureDailyChallengeTable(db: ReturnType<typeof getDb>) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hh2_daily_challenges (
      fid INTEGER NOT NULL,
      challenge_date DATE NOT NULL,
      question_index INTEGER NOT NULL,
      correct BOOLEAN NOT NULL,
      reward_amount INTEGER NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (fid, challenge_date)
    )
  `);
  await ensureStakingTables(db);
}

function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function getQuestionIndex(date: string): number {
  // Deterministic rotation based on the date
  const daySinceEpoch = Math.floor(new Date(date).getTime() / (24 * 60 * 60 * 1000));
  return daySinceEpoch % CHALLENGE_QUESTIONS.length;
}

// ── GET: fetch today's challenge ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const fid = Number(new URL(req.url).searchParams.get('fid'));
    if (!Number.isSafeInteger(fid) || fid <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    }
    if (authFid !== fid) {
      return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });
    }

    const db = getDb();
    await ensureDailyChallengeTable(db);

    const today = getTodayUTC();
    const questionIndex = getQuestionIndex(today);
    const question = CHALLENGE_QUESTIONS[questionIndex];

    const completed = await db.query(
      'SELECT correct, reward_amount, completed_at FROM hh2_daily_challenges WHERE fid = $1 AND challenge_date = $2',
      [fid, today]
    );

    return NextResponse.json({
      ok: true,
      question: {
        question: question.question,
        options: question.options,
        // Don't send the correct answer or explanation until answered
      },
      completedToday: completed.rows.length > 0,
      result: completed.rows.length > 0 ? completed.rows[0] : null,
      reward: DAILY_CHALLENGE_REWARD,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[daily-challenge] GET error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch daily challenge' }, { status: 500 });
  }
}

// ── POST: submit daily challenge answer ──────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`daily-challenge:${ip}`, 10, 60).success) {
    return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 });
  }

  try {
    const authFid = await verifyFarcasterSignerAuth(req);
    const body = await req.json();
    const fid = Number(body.fid);
    const answer = Number(body.answer);

    if (!Number.isSafeInteger(fid) || fid <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid FID required' }, { status: 400 });
    }
    if (authFid !== fid) {
      return NextResponse.json({ ok: false, error: 'FID does not match authenticated user' }, { status: 403 });
    }
    if (!Number.isSafeInteger(answer) || answer < 0) {
      return NextResponse.json({ ok: false, error: 'Valid answer required' }, { status: 400 });
    }

    const db = getDb();
    await ensureDailyChallengeTable(db);

    const today = getTodayUTC();
    const questionIndex = getQuestionIndex(today);
    const question = CHALLENGE_QUESTIONS[questionIndex];

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [fid]);

      // Check if already completed today
      const existing = await client.query(
        'SELECT 1 FROM hh2_daily_challenges WHERE fid = $1 AND challenge_date = $2 FOR UPDATE',
        [fid, today]
      );
      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return NextResponse.json({ ok: false, error: 'You already completed today\'s challenge.' }, { status: 409 });
      }

      const correct = answer === question.correctIndex;
      let rewardAmount = 0;

      if (correct) {
        // Apply staking multiplier if active
        let multiplier = 1.0;
        try {
          multiplier = await getEarningsMultiplier(client, fid);
        } catch { /* non-blocking */ }
        rewardAmount = Math.round(DAILY_CHALLENGE_REWARD * multiplier);

        // Record as a reward event
        const moduleId = `daily-challenge-${today}`;
        await client.query(
          `INSERT INTO hh2_reward_events (fid, module_id, amount, status)
           VALUES ($1, $2, $3, 'earned')
           ON CONFLICT (fid, module_id) DO NOTHING`,
          [fid, moduleId, rewardAmount]
        );
      }

      // Record the challenge completion
      await client.query(
        'INSERT INTO hh2_daily_challenges (fid, challenge_date, question_index, correct, reward_amount) VALUES ($1, $2, $3, $4, $5)',
        [fid, today, questionIndex, correct, rewardAmount]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        ok: true,
        correct,
        reward: rewardAmount,
        explanation: question.explanation,
        correctIndex: question.correctIndex,
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[daily-challenge] POST error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to submit challenge answer' }, { status: 500 });
  }
}
