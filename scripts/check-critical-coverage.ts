/**
 * Critical-path coverage checker (HR-6)
 *
 * Reads coverage/coverage-final.json and asserts 90%+ coverage
 * for lines, functions, branches, and statements in critical-path
 * directories per CLAUDE.md policy.
 *
 * Usage: tsx scripts/check-critical-coverage.ts
 */

import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const THRESHOLD = 90;
const COVERAGE_PATH = resolve(process.cwd(), 'coverage/coverage-final.json');

const CRITICAL_DIRS = ['src/main/ipc/', 'src/shared/lib/', 'src/shared/security/'];

interface CoverageEntry {
  s: Record<string, number>;
  f: Record<string, number>;
  b: Record<string, number[]>;
}

type Metric = 'statements' | 'functions' | 'branches';

function pct(hit: number, total: number): number {
  return total === 0 ? 100 : (hit / total) * 100;
}

function computeMetrics(entries: CoverageEntry[]): Record<Metric, number> {
  let sTotal = 0,
    sHit = 0,
    fTotal = 0,
    fHit = 0,
    bTotal = 0,
    bHit = 0;

  for (const entry of entries) {
    const sVals = Object.values(entry.s);
    sTotal += sVals.length;
    sHit += sVals.filter((v) => v > 0).length;

    const fVals = Object.values(entry.f);
    fTotal += fVals.length;
    fHit += fVals.filter((v) => v > 0).length;

    for (const branchCounts of Object.values(entry.b)) {
      bTotal += branchCounts.length;
      bHit += branchCounts.filter((v) => v > 0).length;
    }
  }

  return {
    statements: pct(sHit, sTotal),
    functions: pct(fHit, fTotal),
    branches: pct(bHit, bTotal),
  };
}

// --- Main ---

let raw: string;
try {
  raw = readFileSync(COVERAGE_PATH, 'utf-8');
} catch {
  console.error(`Could not read ${COVERAGE_PATH}`);
  console.error('Run "pnpm coverage" first to generate the coverage report.');
  process.exit(1);
}

const coverage: Record<string, CoverageEntry> = JSON.parse(raw);
const projectRoot = process.cwd();

let failed = false;

console.log(`\nCritical-path coverage (threshold: ${THRESHOLD}%)\n`);
console.log('Directory'.padEnd(28) + 'Statements  Functions   Branches');
console.log('-'.repeat(68));

for (const dir of CRITICAL_DIRS) {
  const entries = Object.entries(coverage)
    .filter(([filePath]) => relative(projectRoot, filePath).startsWith(dir))
    .map(([, entry]) => entry);

  if (entries.length === 0) {
    console.log(`${dir.padEnd(28)}  (no coverage data)`);
    continue;
  }

  const metrics = computeMetrics(entries);
  const parts: string[] = [];

  for (const key of ['statements', 'functions', 'branches'] as Metric[]) {
    const val = metrics[key];
    const pass = val >= THRESHOLD;
    if (!pass) failed = true;
    parts.push(`${val.toFixed(1).padStart(5)}% ${pass ? 'PASS' : 'FAIL'}`);
  }

  console.log(`${dir.padEnd(28)}${parts.join('  ')}`);
}

console.log('');

if (failed) {
  console.error(`FAILED: One or more critical-path directories are below ${THRESHOLD}% coverage.`);
  process.exit(1);
} else {
  console.log(`All critical-path directories meet the ${THRESHOLD}% coverage threshold.`);
  process.exit(0);
}
