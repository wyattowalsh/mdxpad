import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

interface ParsedOptions {
  runtimeSecurity: boolean;
  reportPath: string;
}

interface StepDefinition {
  id: string;
  title: string;
  command: string;
  args: string[];
}

interface StepResult {
  id: string;
  title: string;
  command: string;
  durationMs: number;
  status: 'pass' | 'fail';
  exitCode: number;
}

const DEFAULT_REPORT_PATH = resolve(
  process.cwd(),
  'artifacts/ci-diagnostics/hardening-rehearsal-report.json'
);

function parseOptions(args: string[]): ParsedOptions {
  let runtimeSecurity = false;
  let reportPath = DEFAULT_REPORT_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg || arg === '--') {
      continue;
    }

    if (arg === '--runtime-security') {
      runtimeSecurity = true;
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

  return { runtimeSecurity, reportPath };
}

function runStep(step: StepDefinition): StepResult {
  console.log(`\n[rehearse-hardening] ${step.title}`);
  const startedAt = Date.now();
  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  const durationMs = Date.now() - startedAt;
  const exitCode = result.status ?? 1;
  return {
    id: step.id,
    title: step.title,
    command: `${step.command} ${step.args.join(' ')}`,
    durationMs,
    status: exitCode === 0 ? 'pass' : 'fail',
    exitCode,
  };
}

function writeReport(reportPath: string, results: StepResult[], runtimeSecurity: boolean): void {
  const failedSteps = results.filter((result) => result.status === 'fail');
  const report = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    runtimeSecurity,
    summary: {
      totalSteps: results.length,
      passedSteps: results.length - failedSteps.length,
      failedSteps: failedSteps.length,
    },
    steps: results,
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[rehearse-hardening] Report: ${reportPath}`);
}

function main(): number {
  const options = parseOptions(process.argv.slice(2));
  const distEntryPath = resolve(process.cwd(), 'dist/main/index.js');
  if (options.runtimeSecurity && !existsSync(distEntryPath)) {
    throw new Error(
      `Runtime security probe requested but ${distEntryPath} does not exist. Run pnpm build first.`
    );
  }

  const steps: StepDefinition[] = [
    {
      id: 'recovery-integrity',
      title: 'Save/recovery integrity rehearsal tests',
      command: 'pnpm',
      args: ['exec', 'vitest', 'run', 'src/main/services/__tests__/recovery-service.test.ts'],
    },
    {
      id: 'message-validation',
      title: 'Message validation rehearsal tests',
      command: 'pnpm',
      args: ['exec', 'vitest', 'run', 'src/shared/security/__tests__/message-validator.test.ts'],
    },
    {
      id: 'security-static',
      title: 'Static security verification',
      command: 'pnpm',
      args: ['verify-security', '--', '--static-only'],
    },
  ];

  if (options.runtimeSecurity) {
    steps.push({
      id: 'security-runtime',
      title: 'Runtime security verification',
      command: 'pnpm',
      args: ['verify-security', '--', '--runtime-only'],
    });
  }

  const results = steps.map((step) => runStep(step));
  writeReport(options.reportPath, results, options.runtimeSecurity);

  const failedSteps = results.filter((result) => result.status === 'fail');
  if (failedSteps.length > 0) {
    console.error(
      `[rehearse-hardening] Failed steps: ${failedSteps.map((result) => result.id).join(', ')}`
    );
    return 1;
  }

  console.log('[rehearse-hardening] All rehearsal checks passed.');
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`[rehearse-hardening] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
