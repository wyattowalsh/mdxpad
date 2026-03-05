import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const WORKFLOWS_DIR = resolve(process.cwd(), '.github/workflows');
const DEFAULT_REPORT_PATH = resolve(
  process.cwd(),
  'artifacts/ci-diagnostics/actions-sha-pinning-report.json'
);
const REPORT_SCHEMA_PATH = '.github/policies/actions-sha-pinning-report.schema.json';
const SHA_REF_REGEX = /^[A-Fa-f0-9]{40}$/;
const USES_LINE_REGEX = /^\s*uses:\s*([^\s#]+)\s*(?:#.*)?$/;
const SCHEMA_VERSION = '1.0.0';

type Mode = 'advisory' | 'enforce';

interface PinningViolation {
  workflow: string;
  line: number;
  uses: string;
  reference: string;
  policy: 'sha-pinned-action-ref';
}

interface PinningReport {
  schemaVersion: typeof SCHEMA_VERSION;
  schema: string;
  generatedAt: string;
  repository: string | null;
  mode: Mode;
  summary: {
    workflowFiles: number;
    totalActionUsages: number;
    pinnedActionUsages: number;
    unpinnedActionUsages: number;
  };
  violations: PinningViolation[];
}

interface ParsedOptions {
  mode: Mode;
  reportPath: string;
}

interface UsesClassification {
  isRemoteAction: boolean;
  reference: string;
  isPinned: boolean;
}

function isProtectedCiContext(): boolean {
  const inCi = process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true';
  if (!inCi) {
    return false;
  }

  if (process.env.GITHUB_REF_PROTECTED === 'true') {
    return true;
  }

  const ref = process.env.GITHUB_REF ?? '';
  return ref === 'refs/heads/main' || ref.startsWith('refs/tags/');
}

function parseMode(raw: string | undefined): Mode | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.toLowerCase();
  if (normalized === 'advisory' || normalized === 'enforce') {
    return normalized;
  }

  return null;
}

function parseOptions(args: string[]): ParsedOptions {
  const modeFromEnv = parseMode(process.env.CI_ACTION_PINNING_MODE);
  const reportPathFromEnv = process.env.CI_ACTION_PINNING_REPORT_PATH;

  let mode: Mode = modeFromEnv ?? 'advisory';
  let reportPath = reportPathFromEnv
    ? resolve(process.cwd(), reportPathFromEnv)
    : DEFAULT_REPORT_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }

    if (arg === '--') {
      continue;
    }

    if (arg === '--enforce') {
      mode = 'enforce';
      continue;
    }

    if (arg === '--advisory') {
      mode = 'advisory';
      continue;
    }

    if (arg === '--mode') {
      const next = args[index + 1];
      if (!next) {
        throw new Error('Missing value after --mode');
      }
      const parsed = parseMode(next);
      if (!parsed) {
        throw new Error(`Invalid --mode value: ${next}`);
      }
      mode = parsed;
      index += 1;
      continue;
    }

    if (arg.startsWith('--mode=')) {
      const parsed = parseMode(arg.slice('--mode='.length));
      if (!parsed) {
        throw new Error(`Invalid --mode value: ${arg.slice('--mode='.length)}`);
      }
      mode = parsed;
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

  return { mode, reportPath };
}

function classifyUsesReference(usesReference: string): UsesClassification {
  if (usesReference.startsWith('./') || usesReference.startsWith('docker://')) {
    return {
      isRemoteAction: false,
      reference: '',
      isPinned: true,
    };
  }

  const refSeparator = usesReference.lastIndexOf('@');
  if (refSeparator === -1) {
    return {
      isRemoteAction: false,
      reference: '',
      isPinned: true,
    };
  }

  const reference = usesReference.slice(refSeparator + 1);
  return {
    isRemoteAction: true,
    reference,
    isPinned: SHA_REF_REGEX.test(reference),
  };
}

function buildReport(mode: Mode): PinningReport {
  const workflowFiles = readdirSync(WORKFLOWS_DIR)
    .filter((fileName) => fileName.endsWith('.yml') || fileName.endsWith('.yaml'))
    .sort();

  const violations: PinningViolation[] = [];
  let totalActionUsages = 0;
  let pinnedActionUsages = 0;

  for (const workflowFile of workflowFiles) {
    const workflowPath = resolve(WORKFLOWS_DIR, workflowFile);
    const lines = readFileSync(workflowPath, 'utf8').split(/\r?\n/u);

    for (const [index, line] of lines.entries()) {
      const match = USES_LINE_REGEX.exec(line);
      if (!match) {
        continue;
      }

      const usesReference = match[1];
      if (!usesReference) {
        continue;
      }

      const classification = classifyUsesReference(usesReference);
      if (!classification.isRemoteAction) {
        continue;
      }

      totalActionUsages += 1;
      if (classification.isPinned) {
        pinnedActionUsages += 1;
        continue;
      }

      violations.push({
        workflow: `.github/workflows/${workflowFile}`,
        line: index + 1,
        uses: usesReference,
        reference: classification.reference,
        policy: 'sha-pinned-action-ref',
      });
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    schema: REPORT_SCHEMA_PATH,
    generatedAt: new Date().toISOString(),
    repository: process.env.GITHUB_REPOSITORY ?? null,
    mode,
    summary: {
      workflowFiles: workflowFiles.length,
      totalActionUsages,
      pinnedActionUsages,
      unpinnedActionUsages: violations.length,
    },
    violations,
  };
}

function main(): number {
  const options = parseOptions(process.argv.slice(2));

  if (options.mode === 'advisory' && isProtectedCiContext()) {
    console.error(
      '[verify-actions-pinning] Advisory mode is not allowed for protected CI refs. Use enforce mode.'
    );
    return 1;
  }

  const report = buildReport(options.mode);

  mkdirSync(dirname(options.reportPath), { recursive: true });
  writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[verify-actions-pinning] Report: ${options.reportPath}`);
  console.log(
    `[verify-actions-pinning] Workflows: ${report.summary.workflowFiles}, action refs: ${report.summary.totalActionUsages}, unpinned: ${report.summary.unpinnedActionUsages}`
  );

  if (report.summary.unpinnedActionUsages > 0) {
    if (options.mode === 'enforce') {
      console.error('[verify-actions-pinning] Unpinned action references found (enforce mode).');
      return 1;
    }
    console.warn('[verify-actions-pinning] Unpinned action references found (advisory mode).');
  } else {
    console.log('[verify-actions-pinning] All remote action references are SHA pinned.');
  }

  return 0;
}

try {
  const exitCode = main();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[verify-actions-pinning] ${message}`);
  process.exitCode = 1;
}
