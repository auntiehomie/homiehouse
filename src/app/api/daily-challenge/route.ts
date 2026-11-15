import { NextRequest, NextResponse } from 'next/server';
import { getDailyDraw } from '@/lib/daily-challenge-draw';
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

// Append new questions to preserve the historical draw indices.
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
  {
    question: "What does a wallet use to authorize a transaction?",
    options: ["A digital signature", "A block explorer", "A DNS record", "A token symbol"],
    correctIndex: 0,
    explanation: "The wallet signs with a private key, and the network can verify the signature without seeing that key.",
  },
  {
    question: "What does a recovery phrase let you do?",
    options: ["Restore access to keys derived from it", "Change a confirmed transaction", "Recover an exchange password", "Reduce gas fees"],
    correctIndex: 0,
    explanation: "A compatible wallet can derive its keys again from the recovery phrase.",
  },
  {
    question: "What is an Ethereum smart contract?",
    options: ["A program deployed on Ethereum", "A paper agreement scanned into a wallet", "A secret validator key", "An exchange account"],
    correctIndex: 0,
    explanation: "A deployed contract contains code the Ethereum network can execute.",
  },
  {
    question: "What does a rollup typically batch together?",
    options: ["Layer 2 transactions", "Wallet recovery phrases", "Domain registrations", "Validator passwords"],
    correctIndex: 0,
    explanation: "Rollups process groups of transactions and post data or commitments to a base chain.",
  },
  {
    question: "What is a block explorer used for?",
    options: ["Looking up onchain activity", "Resetting private keys", "Increasing block capacity", "Reversing transfers"],
    correctIndex: 0,
    explanation: "A block explorer indexes and displays public transactions, blocks, and addresses.",
  },
  {
    question: "What does a token allowance authorize?",
    options: ["A spender to move up to a specified amount of your tokens", "Any validator to reset your wallet", "A token to change its symbol", "A wallet to disable gas charges"],
    correctIndex: 0,
    explanation: "An allowance grants a particular spender permission to transfer tokens up to the approved amount.",
  },
  {
    question: "What does a stablecoin aim to track?",
    options: ["A reference value such as one US dollar", "The number of Ethereum validators", "Every crypto asset equally", "The price of gas"],
    correctIndex: 0,
    explanation: "A stablecoin is designed to track a reference value, though its market price can move away from that value.",
  },
  {
    question: "What is the role of Ethereum gas?",
    options: ["Measure computational work", "Store your account password", "Prove token ownership by itself", "Select a wallet provider"],
    correctIndex: 0,
    explanation: "Gas measures the work required by operations so the network can charge for resource use.",
  },
  {
    question: "What does a content hash help you check?",
    options: ["Whether bytes match an expected version", "Who legally owns a document", "Whether a claim is true", "Which browser created a file"],
    correctIndex: 0,
    explanation: "A content hash can be recomputed and compared to an expected hash to detect changes.",
  },
  {
    question: "What does end-to-end encryption protect from a message relay?",
    options: ["The plaintext message content", "Every piece of routing metadata", "The existence of a network connection", "The time the message was delivered in all systems"],
    correctIndex: 0,
    explanation: "An intermediary forwards ciphertext while the endpoints hold the keys needed to read the content.",
  },
  {
    question: "What can a zero-knowledge proof demonstrate?",
    options: ["That a statement is true without revealing its secret witness", "That every transaction is anonymous", "That backups are unnecessary", "That a network cannot go offline"],
    correctIndex: 0,
    explanation: "A valid zero-knowledge proof establishes a statement without exposing the underlying private witness.",
  },
  {
    question: "What is a multisignature wallet designed to require?",
    options: ["A configured threshold of approvals", "Exactly one signature for every transfer", "A new wallet address for every token", "A validator vote for every login"],
    correctIndex: 0,
    explanation: "Multisig policies can require a threshold such as two of three authorized signers.",
  },
  {
    question: "What is a DAO governance proposal?",
    options: ["A proposed action or policy for members to consider", "A wallet backup file", "An Ethereum transaction fee", "An exchange withdrawal hold"],
    correctIndex: 0,
    explanation: "Proposals give the organization a defined decision to discuss and potentially vote on.",
  },
  {
    question: "What does portability in decentralized social help users do?",
    options: ["Use the same supported identity across compatible clients", "Hide every public post automatically", "Remove every copy of a post", "Guarantee the same feed ranking everywhere"],
    correctIndex: 0,
    explanation: "Compatible clients can recognize a shared protocol identity even when their interfaces differ.",
  },
  {
    question: "In Farcaster, what does an FID identify?",
    options: ["An account", "A gas fee", "A smart contract function", "A recovery phrase"],
    correctIndex: 0,
    explanation: "An FID is the protocol’s numeric identifier for an account.",
  },
  {
    question: "What does an automated market maker use to quote trades?",
    options: ["A pricing rule applied to a liquidity pool", "An email from a broker", "A wallet recovery phrase", "A block explorer search result"],
    correctIndex: 0,
    explanation: "An AMM uses a pricing rule and pool state to determine swap quotes.",
  },
  {
    question: "What is data availability concerned with?",
    options: ["Whether participants can obtain the data needed to verify state", "Whether a wallet can remember a password", "Whether a token can change its logo", "Whether a block explorer has dark mode"],
    correctIndex: 0,
    explanation: "Verification depends on participants being able to access the relevant data.",
  },
  {
    question: "In AI, what is a tool call?",
    options: ["A structured request for an external function to do work", "A replacement for all user consent", "A model weight update", "A cryptographic signature by default"],
    correctIndex: 0,
    explanation: "An application can validate a model’s tool request before passing it to a function.",
  },
  {
    question: "What does a read-only permission allow?",
    options: ["Viewing data within the permitted scope", "Overwriting a file", "Deleting a database row", "Granting write permissions"],
    correctIndex: 0,
    explanation: "Read-only permissions allow inspection while withholding write operations.",
  },
  {
    question: "Why might a locally stored backup be encrypted?",
    options: ["To protect its contents if someone obtains a copy", "To improve network speed", "To make updates unnecessary", "To make duplicate copies physically impossible"],
    correctIndex: 0,
    explanation: "Encryption protects the contents as long as the decryption key remains protected.",
  },
  {
    question: "What does a transaction receipt show on Ethereum?",
    options: ["The execution result of an included transaction", "The sender’s private key", "The exact time an unsubmitted transaction will land", "The password for a wallet"],
    correctIndex: 0,
    explanation: "A receipt records the result after inclusion, including status and any emitted logs.",
  },
  {
    question: "What does quadratic voting make more expensive?",
    options: ["Concentrating more votes on one choice", "Reading a proposal", "Abstaining from a vote", "Counting the first vote"],
    correctIndex: 0,
    explanation: "In a typical quadratic voting scheme, the total cost scales with the square of the votes assigned to a choice.",
  },
  {
    question: "What does a bridge connect in a blockchain ecosystem?",
    options: ["Different networks that need to exchange assets or messages", "A wallet and its recovery phrase", "A validator and its password", "Two tabs in the same browser"],
    correctIndex: 0,
    explanation: "A bridge passes information between networks and can support cross-network asset transfers.",
  },
  {
    question: "Why does an Ethereum wallet show the chain before a transaction?",
    options: ["The target network determines where the transaction takes effect", "Each chain requires the wallet password onchain", "A signature automatically sends funds on all chains", "All chains share the same transaction history"],
    correctIndex: 0,
    explanation: "An account can use the same address on several networks while the networks have separate state.",
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

async function ensureRewardEventTable(db: ReturnType<typeof getDb>) {
  // Daily challenge awards smaller amounts than lesson rewards. Keep the
  // shared ledger's amount check aligned with the current positive-integer
  // contract; older databases may still have a stricter legacy constraint.
  await db.query(`
    CREATE TABLE IF NOT EXISTS hh2_reward_events (
      fid INTEGER NOT NULL, module_id TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      status TEXT NOT NULL DEFAULT 'earned' CHECK (status IN ('earned', 'pending', 'claimed')),
      wallet_address TEXT, claim_tx_hash TEXT,
      earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), claimed_at TIMESTAMPTZ,
      PRIMARY KEY (fid, module_id)
    )
  `);
  await db.query(`
    DO $hh2$
    DECLARE
      amount_constraint_definition TEXT;
    BEGIN
      -- Serialize the one-time repair when multiple Learn pages load together.
      PERFORM pg_advisory_xact_lock(760042001);
      SELECT pg_get_constraintdef(oid)
        INTO amount_constraint_definition
        FROM pg_constraint
        WHERE conrelid = 'hh2_reward_events'::regclass
          AND conname = 'hh2_reward_events_amount_check';

      IF amount_constraint_definition IS NULL THEN
        ALTER TABLE hh2_reward_events
          ADD CONSTRAINT hh2_reward_events_amount_check CHECK (amount > 0);
      ELSIF regexp_replace(lower(amount_constraint_definition), '[[:space:]()]', '', 'g') <> 'checkamount>0' THEN
        ALTER TABLE hh2_reward_events DROP CONSTRAINT hh2_reward_events_amount_check;
        ALTER TABLE hh2_reward_events
          ADD CONSTRAINT hh2_reward_events_amount_check CHECK (amount > 0);
      END IF;
    END
    $hh2$;
  `);
}

function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0];
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
    const { question } = await getDailyDraw(db, today, CHALLENGE_QUESTIONS);

    const completed = await db.query(
      'SELECT correct, reward_amount, completed_at FROM hh2_daily_challenges WHERE fid = $1 AND challenge_date = $2',
      [fid, today]
    );

    return NextResponse.json({
      ok: true,
      challengeDate: today,
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
    const answer = body.answer;

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
    await ensureRewardEventTable(db);

    const today = getTodayUTC();
    if (body.challengeDate !== today) {
      return NextResponse.json({ ok: false, error: 'Refresh to load today’s challenge.' }, { status: 409 });
    }
    const { question_index: questionIndex, question } = await getDailyDraw(db, today, CHALLENGE_QUESTIONS);
    if (answer >= question.options.length) {
      return NextResponse.json({ ok: false, error: 'Valid answer required' }, { status: 400 });
    }

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
