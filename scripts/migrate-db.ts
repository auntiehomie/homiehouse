/**
 * Migrate the app's Postgres data from one Neon database to another —
 * e.g. a standalone Neon project → a Vercel-provisioned Neon database.
 *
 * Both endpoints are standard Postgres, so this wraps `pg_dump` / `pg_restore`
 * and then VERIFIES that every table's row count matches on both sides before
 * you cut over. Run it from your machine (needs the Postgres client tools:
 * `pg_dump`, `pg_restore` — install via `brew install libpq` or `postgresql`).
 *
 * Usage:
 *   OLD_DATABASE_URL="postgres://…old-neon…"  \
 *   NEW_DATABASE_URL="postgres://…vercel-neon…"  \
 *   npx tsx scripts/migrate-db.ts [--verify-only] [--yes]
 *
 * Flags:
 *   --verify-only   Skip dump/restore; only compare row counts (run this after
 *                   a migration you did by hand, to confirm nothing was lost).
 *   --yes           Skip the confirmation prompt.
 *
 * Notes:
 *   • Use the POOLED connection strings (host contains "-pooler").
 *   • The NEW database should be empty/fresh — restore uses --clean --if-exists,
 *     which drops matching objects in NEW before loading. It never touches OLD.
 *   • This is a copy, not a move: OLD is only ever read from.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Client } from 'pg';

const OLD = process.env.OLD_DATABASE_URL;
const NEW = process.env.NEW_DATABASE_URL;
const args = process.argv.slice(2);
const VERIFY_ONLY = args.includes('--verify-only');
const ASSUME_YES = args.includes('--yes');

function die(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function redact(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username}:***@${u.host}${u.pathname}`;
  } catch {
    return '(unparseable url)';
  }
}

function ensureTool(tool: string): void {
  try {
    execFileSync(tool, ['--version'], { stdio: 'ignore' });
  } catch {
    die(`\`${tool}\` not found on PATH. Install the Postgres client tools (e.g. \`brew install libpq\` then add its bin to PATH, or \`apt-get install postgresql-client\`).`);
  }
}

function confirm(question: string): Promise<boolean> {
  if (ASSUME_YES) return Promise.resolve(true);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (a) => {
      rl.close();
      resolve(/^y(es)?$/i.test(a.trim()));
    });
  });
}

/** All base tables in the public schema. */
async function listTables(client: Client): Promise<string[]> {
  const { rows } = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  return rows.map((r) => r.table_name);
}

async function rowCount(client: Client, table: string): Promise<number | null> {
  // table names come from information_schema; still validate before interpolating
  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) return null;
  try {
    const { rows } = await client.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM "${table}"`);
    return parseInt(rows[0]?.n ?? '0', 10);
  } catch {
    return null; // table missing on this side
  }
}

function connect(url: string): Client {
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
}

async function verify(): Promise<boolean> {
  const oldC = connect(OLD!);
  const newC = connect(NEW!);
  await oldC.connect();
  await newC.connect();
  try {
    const tables = await listTables(oldC);
    if (tables.length === 0) {
      console.warn('⚠️  OLD database has no public tables — nothing to verify.');
      return true;
    }

    console.log(`\n${'TABLE'.padEnd(24)} ${'OLD'.padStart(10)} ${'NEW'.padStart(10)}   STATUS`);
    console.log('─'.repeat(60));

    let allMatch = true;
    for (const t of tables) {
      const [o, n] = await Promise.all([rowCount(oldC, t), rowCount(newC, t)]);
      const match = o !== null && o === n;
      if (!match) allMatch = false;
      const status = n === null ? 'MISSING in NEW' : match ? '✓' : `MISMATCH (Δ ${(n ?? 0) - (o ?? 0)})`;
      console.log(`${t.padEnd(24)} ${String(o ?? '—').padStart(10)} ${String(n ?? '—').padStart(10)}   ${status}`);
    }
    console.log('─'.repeat(60));
    console.log(allMatch ? '✅ All tables match.\n' : '❌ Row counts do NOT match — do not cut over yet.\n');
    return allMatch;
  } finally {
    await oldC.end().catch(() => {});
    await newC.end().catch(() => {});
  }
}

async function dumpRestore(): Promise<void> {
  ensureTool('pg_dump');
  ensureTool('pg_restore');

  const dir = mkdtempSync(join(tmpdir(), 'hh-migrate-'));
  const dumpFile = join(dir, 'hh.dump');
  try {
    console.log('\n1/2  Dumping OLD database…');
    // -Fc custom format, no owner/privileges so it restores cleanly into a fresh role
    execFileSync('pg_dump', [OLD!, '--no-owner', '--no-privileges', '-Fc', '-f', dumpFile], {
      stdio: 'inherit',
    });

    console.log('2/2  Restoring into NEW database…');
    // --clean --if-exists makes it re-runnable against a fresh target
    execFileSync(
      'pg_restore',
      ['--no-owner', '--no-privileges', '--clean', '--if-exists', '-d', NEW!, dumpFile],
      { stdio: 'inherit' }
    );
    console.log('✅ Dump/restore complete.');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  if (!OLD || !NEW) {
    die('Set both OLD_DATABASE_URL and NEW_DATABASE_URL.\n' +
        '  OLD_DATABASE_URL=… NEW_DATABASE_URL=… npx tsx scripts/migrate-db.ts');
  }
  if (OLD === NEW) die('OLD_DATABASE_URL and NEW_DATABASE_URL are identical — refusing to run.');

  console.log(`OLD (source, read-only): ${redact(OLD)}`);
  console.log(`NEW (target):            ${redact(NEW)}`);

  if (VERIFY_ONLY) {
    const ok = await verify();
    process.exit(ok ? 0 : 1);
  }

  const proceed = await confirm(
    '\nThis will DUMP the OLD db and RESTORE into the NEW db (dropping matching objects in NEW). Continue?'
  );
  if (!proceed) die('Aborted.');

  await dumpRestore();
  const ok = await verify();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => die(err?.message ?? String(err)));
