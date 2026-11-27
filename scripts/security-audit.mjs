import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let output;
try {
  output = execFileSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
} catch (error) {
  // npm exits with a nonzero status when it finds vulnerabilities.
  if (!error.stdout || error.signal || error.code) throw error;
  output = error.stdout;
}

const report = JSON.parse(output);
const totals = report.metadata?.vulnerabilities;
if (report.error || !report.vulnerabilities || Array.isArray(report.vulnerabilities) ||
    !['critical', 'high', 'moderate', 'low'].every(level => Number.isInteger(totals?.[level]))) {
  console.error('Production dependency audit did not return a valid advisory report.');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(new URL('./security-audit-baseline.json', import.meta.url), 'utf8'));
const acceptedCritical = new Set(baseline.critical);
const acceptedFixable = new Set(baseline.fixable);
const unexpected = new Set();

function advisoriesFor(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  return (report.vulnerabilities[name]?.via ?? []).flatMap(item =>
    typeof item === 'string' ? advisoriesFor(item, seen) : [item],
  );
}

for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
  const advisories = advisoriesFor(name);
  if (vulnerability.severity === 'critical' &&
      !advisories.some(item => item.severity === 'critical')) {
    unexpected.add(`${name}: critical finding without an advisory ID`);
  }
  for (const item of advisories) {
    const key = `${item.name}:${item.source}`;
    if (item.severity === 'critical' && !acceptedCritical.has(key)) {
      unexpected.add(`critical: ${key}`);
    }
    if (vulnerability.fixAvailable && ['high', 'moderate'].includes(item.severity) &&
        !acceptedFixable.has(key)) {
      unexpected.add(`fixable ${item.severity}: ${key}`);
    }
  }
}

console.log(`Production audit: ${totals.critical} critical, ${totals.high} high, ${totals.moderate} moderate, ${totals.low} low`);
if (unexpected.size) {
  console.error('Production advisories outside the reviewed baseline:');
  for (const item of [...unexpected].sort()) console.error(`- ${item}`);
  process.exit(1);
}
console.log('No unexpected critical or new fixable high/moderate production advisories.');
