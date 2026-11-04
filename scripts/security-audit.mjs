import { execFileSync } from 'node:child_process';

let output;
try {
  output = execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8' });
} catch (error) {
  output = error.stdout;
  if (!output) throw error;
}

const report = JSON.parse(output);
const acceptedCriticalAdvisories = new Set([
  // WalletConnect v1's elliptic chain has no upstream fix. Keep this explicit
  // until wallet.ts migrates to Reown WalletKit; fail CI for any new critical.
  1102901,
]);
const unexpected = [];

function criticalAdvisoryIds(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const vulnerability = report.vulnerabilities?.[name];
  if (!vulnerability) return [];
  return vulnerability.via.flatMap((item) => {
    if (typeof item === 'string') return criticalAdvisoryIds(item, seen);
    return item.severity === 'critical' ? [item.source] : [];
  });
}

for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
  if (vulnerability.severity !== 'critical') continue;
  const ids = criticalAdvisoryIds(name);
  if (ids.length === 0 || ids.some((id) => !acceptedCriticalAdvisories.has(id))) unexpected.push(name);
}

const totals = report.metadata?.vulnerabilities ?? {};
console.log(`Production audit: ${totals.critical ?? 0} critical, ${totals.high ?? 0} high, ${totals.moderate ?? 0} moderate, ${totals.low ?? 0} low`);
if (unexpected.length) {
  console.error(`New critical advisories affect: ${unexpected.join(', ')}`);
  process.exit(1);
}
console.log('No new critical production advisories beyond the documented WalletConnect v1 exception.');
