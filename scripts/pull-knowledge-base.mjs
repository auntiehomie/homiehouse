#!/usr/bin/env node
// Pulls the curated Homiehouse learning corpus from the private
// auntiehomie/knowledge-base repository into src/content/knowledge-base.
//
// Homiehouse never reads that repository at runtime: the corpus is vendored
// here and shipped with the build, so production needs no GitHub token.
//
// Usage:
//   npm run kb:pull                        # fetch from GitHub (needs a token)
//   npm run kb:pull -- --file <path>       # copy from a local checkout
//   npm run kb:pull -- --check             # fail if the vendored copy is stale
//
// Token: KNOWLEDGE_BASE_TOKEN, then GITHUB_TOKEN, then `gh auth token`.
// It only needs read access to the contents of auntiehomie/knowledge-base.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = process.env.KNOWLEDGE_BASE_REPO || 'auntiehomie/knowledge-base';
const REF = process.env.KNOWLEDGE_BASE_REF || 'main';
const SOURCE_PATH = 'homiehouse/articles.json';
const TARGET = fileURLToPath(new URL('../src/content/knowledge-base/articles.json', import.meta.url));

function token() {
  if (process.env.KNOWLEDGE_BASE_TOKEN) return process.env.KNOWLEDGE_BASE_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

async function fetchRemote() {
  const auth = token();
  if (!auth) throw new Error('No token found. Set KNOWLEDGE_BASE_TOKEN or sign in with `gh auth login`.');
  const url = `https://api.github.com/repos/${REPO}/contents/${SOURCE_PATH}?ref=${encodeURIComponent(REF)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${auth}`,
      Accept: 'application/vnd.github.raw+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'homiehouse-kb-pull',
    },
  });
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for ${REPO}/${SOURCE_PATH}@${REF}`);
  return res.text();
}

// Same record rules as syncKnowledgeBase in src/lib/kb-sync.ts. A corpus that
// would make the sync reject every article must never be vendored.
export function validateCorpus(data) {
  const errors = [];
  if (!data || !Array.isArray(data.articles) || data.articles.length === 0) {
    return ['articles must be a non-empty array'];
  }
  const ids = new Set();
  for (const [i, a] of data.articles.entries()) {
    const at = `articles[${i}] (${a?.id ?? 'no id'})`;
    if (!a.id || !a.title || !a.url || !a.source || !a.summary) errors.push(`${at}: id, title, url, source and summary are required`);
    if (ids.has(a.id)) errors.push(`${at}: duplicate id`);
    ids.add(a.id);
    try {
      if (new URL(a.url).protocol !== 'https:') errors.push(`${at}: url must be https`);
    } catch {
      errors.push(`${at}: url is invalid`);
    }
    if (!Array.isArray(a.tags) || a.tags.length === 0) errors.push(`${at}: needs at least one tag`);
    if (!Array.isArray(a.learningPoints) || a.learningPoints.length < 2) errors.push(`${at}: needs at least two learningPoints`);
  }
  return errors;
}

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const check = args.includes('--check');
  const raw = fileIdx >= 0 ? readFileSync(args[fileIdx + 1], 'utf8') : await fetchRemote();

  const data = JSON.parse(raw);
  const errors = validateCorpus(data);
  if (errors.length) {
    console.error(`Upstream corpus is invalid, not vendoring it:\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }

  const next = `${JSON.stringify(data, null, 2)}\n`;
  const current = readFileSync(TARGET, 'utf8');
  if (current === next) {
    console.log(`Knowledge base is up to date (${data.articles.length} articles).`);
    return;
  }
  if (check) {
    console.error('Vendored knowledge base differs from upstream. Run `npm run kb:pull`.');
    process.exit(1);
  }
  writeFileSync(TARGET, next);
  console.log(`Updated src/content/knowledge-base/articles.json (${data.articles.length} articles).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
