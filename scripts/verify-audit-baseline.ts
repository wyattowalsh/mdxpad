import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_BASELINE_PATH = resolve(process.cwd(), '.github/policies/npm-audit-baseline.json');
const DEFAULT_REPORT_PATH = resolve(process.cwd(), 'artifacts/ci-diagnostics/npm-audit-baseline-report.json');

interface Advisory {
  id: number;
  module_name: string;
  severity: string;
  title?: string;
  vulnerable_versions?: string;
  patched_versions?: string;
  findings?: { paths?: string[] }[];
}

interface BaselineEntry {
  id: number;
  package: string;
  severity: 'high' | 'critical';
  rationale: string;
}

interface BaselineFile {
  schemaVersion: string;
  updatedAt: string;
  entries: BaselineEntry[];
}

interface ParsedOptions {
  baselinePath: string;
  reportPath: string;
}

function parseOptions(args: string[]): ParsedOptions {
  let baselinePath = DEFAULT_BASELINE_PATH;
  let reportPath = DEFAULT_REPORT_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg || arg === '--') {
      continue;
    }

    if (arg === '--baseline') {
      const next = args[index + 1];
      if (!next) {
        throw new Error('Missing path after --baseline');
      }
      baselinePath = resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg.startsWith('--baseline=')) {
      baselinePath = resolve(process.cwd(), arg.slice('--baseline='.length));
      continue;
    }

    if (arg === '--report') {
      const next = args[index + 1];
      if (!next) {
        throw new Error('Missing path after --report');
      }
      reportPath = resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg.startsWith('--report=')) {
      reportPath = resolve(process.cwd(), arg.slice('--report='.length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { baselinePath, reportPath };
}

function loadBaseline(baselinePath: string): BaselineFile {
  const raw = readFileSync(baselinePath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<BaselineFile>;
  if (parsed.schemaVersion !== '1.0.0' || !Array.isArray(parsed.entries)) {
    throw new Error(`Invalid baseline schema at ${baselinePath}`);
  }
  return {
    schemaVersion: parsed.schemaVersion,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    entries: parsed.entries,
  };
}

function runAudit(): Advisory[] {
  const result = spawnSync('pnpm', ['audit', '--audit-level', 'high', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });

  const stdout = result.stdout.trim();
  if (!stdout) {
    throw new Error('pnpm audit produced no output');
  }

  const parsed = JSON.parse(stdout) as { advisories?: Record<string, Advisory> };
  const advisories = Object.values(parsed.advisories ?? {});
  return advisories.filter((advisory) => {
    const severity = advisory.severity.toLowerCase();
    return severity === 'high' || severity === 'critical';
  });
}

function main(): number {
  const options = parseOptions(process.argv.slice(2));
  const baseline = loadBaseline(options.baselinePath);
  const advisories = runAudit();

  const baselineById = new Map(baseline.entries.map((entry) => [entry.id, entry]));
  const unexpected = advisories.filter((advisory) => !baselineById.has(advisory.id));
  const matchedIds = new Set(advisories.map((advisory) => advisory.id));
  const resolved = baseline.entries.filter((entry) => !matchedIds.has(entry.id));

  const report = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    baselinePath: options.baselinePath,
    summary: {
      observedHighOrCritical: advisories.length,
      baselineEntries: baseline.entries.length,
      unexpectedFindings: unexpected.length,
      resolvedFindings: resolved.length,
    },
    unexpectedFindings: unexpected.map((advisory) => ({
      id: advisory.id,
      package: advisory.module_name,
      severity: advisory.severity,
      title: advisory.title ?? '',
      vulnerableVersions: advisory.vulnerable_versions ?? '',
      patchedVersions: advisory.patched_versions ?? '',
      dependencyPaths: advisory.findings?.flatMap((finding) => finding.paths ?? []) ?? [],
    })),
    baselineMatches: advisories
      .filter((advisory) => baselineById.has(advisory.id))
      .map((advisory) => ({
        id: advisory.id,
        package: advisory.module_name,
        severity: advisory.severity,
      })),
    resolvedFindings: resolved,
  };

  mkdirSync(dirname(options.reportPath), { recursive: true });
  writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[verify-audit-baseline] Report: ${options.reportPath}`);
  console.log(
    `[verify-audit-baseline] Observed high/critical: ${advisories.length}, unexpected: ${unexpected.length}, resolved: ${resolved.length}`
  );

  if (unexpected.length > 0) {
    console.error('[verify-audit-baseline] Unexpected high/critical advisories detected.');
    return 1;
  }

  if (resolved.length > 0) {
    console.error(
      `[verify-audit-baseline] ${resolved.length} baseline advisories are no longer present. Remove resolved entries from baseline before merging.`
    );
    return 1;
  }

  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(
    `[verify-audit-baseline] ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
