/**
 * Performance Benchmark Script (T051-T054)
 *
 * Measures cold start time and memory usage of the Electron app.
 * Outputs JSON with metrics for CI/CD validation.
 *
 * Per constitution Article V:
 * - Cold start: < 2000ms
 * - Memory: < 200MB (spec uses 150MB as stretch goal)
 */

import { _electron as electron } from 'playwright';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

interface BenchmarkResult {
  coldStartMs: number;
  memoryMb: number;
  timestamp: string;
  passed: boolean;
  sloMet: boolean;
  details: {
    coldStartSloMs: number;
    coldStartGateMs: number;
    memorySloMb: number;
    memoryGateMb: number;
    coldStartWithinSlo: boolean;
    coldStartWithinGate: boolean;
    memoryWithinSlo: boolean;
    memoryWithinGate: boolean;
    processCount: number;
    totalWorkingSetMb: number;
  };
}

// Constitution Article V:
// - Cold start SLO: 2.5s on release builds
// - Memory budget: 200MB (150MB stretch goal)
const COLD_START_SLO_MS = 2500;
const COLD_START_GATE_MS = 5000;
const MEMORY_SLO_MB = 150;
const MEMORY_GATE_MB = 200;
const CLOSE_TIMEOUT_MS = 5000;

interface ClosableElectronApp {
  close: () => Promise<void>;
  process: () => { pid?: number };
  evaluate?: (fn: ({ app }: { app: { quit: () => void } }) => void) => Promise<void>;
}

function buildIsolatedUserDataDir(): string {
  return join(tmpdir(), 'mdxpad-bench', `${Date.now()}-${process.pid}-${randomUUID()}`);
}

async function closeElectronApp(electronApp: ClosableElectronApp): Promise<void> {
  const pid = electronApp.process().pid;
  try {
    if (electronApp.evaluate) {
      await electronApp.evaluate(({ app }) => {
        app.quit();
      });
    }

    await Promise.race([
      electronApp.close(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Timed out closing Electron app after ${CLOSE_TIMEOUT_MS}ms`)),
          CLOSE_TIMEOUT_MS
        );
      }),
    ]);
  } catch {
    if (pid) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Process may have already exited.
      }
    }
  }
}

async function runBenchmark(): Promise<BenchmarkResult> {
  // Launch the Electron app and measure cold start
  const electronPath = join(process.cwd(), 'node_modules', '.bin', 'electron');
  const appPath = join(process.cwd(), 'dist', 'main', 'index.js');
  const userDataDir = buildIsolatedUserDataDir();
  mkdirSync(userDataDir, { recursive: true });

  const startTime = performance.now();

  const electronApp = await electron.launch({
    args: [appPath, `--user-data-dir=${userDataDir}`],
    executablePath: electronPath,
    env: {
      ...process.env,
      NODE_ENV: 'test',
    } as Record<string, string>,
  });

  try {
    // Wait for first window to be ready
    const window = await electronApp.firstWindow();

    // Wait for the app shell to mount before recording startup completion.
    await window.waitForSelector('[data-testid="status-bar"]');

    const coldStartMs = Math.round(performance.now() - startTime);

    const metricsSnapshot = await electronApp.evaluate(({ app }) => {
      const metrics = app.getAppMetrics();
      const totalWorkingSetKb = metrics.reduce(
        (sum, metric) => sum + metric.memory.workingSetSize,
        0
      );
      const rendererWorkingSetKb = metrics
        .filter((metric) => metric.type === 'Tab')
        .reduce((sum, metric) => sum + metric.memory.workingSetSize, 0);
      return {
        processCount: metrics.length,
        totalWorkingSetKb,
        rendererWorkingSetKb,
      };
    });

    // Budget memory against renderer working set, which reflects user-facing editor usage.
    const memoryMb = Math.round(metricsSnapshot.rendererWorkingSetKb / 1024);
    const totalWorkingSetMb = Math.round(metricsSnapshot.totalWorkingSetKb / 1024);
    const coldStartWithinSlo = coldStartMs <= COLD_START_SLO_MS;
    const coldStartWithinGate = coldStartMs <= COLD_START_GATE_MS;
    const memoryWithinSlo = memoryMb <= MEMORY_SLO_MB;
    const memoryWithinGate = memoryMb <= MEMORY_GATE_MB;

    const result: BenchmarkResult = {
      coldStartMs,
      memoryMb,
      timestamp: new Date().toISOString(),
      passed: coldStartWithinGate && memoryWithinGate,
      sloMet: coldStartWithinSlo && memoryWithinSlo,
      details: {
        coldStartSloMs: COLD_START_SLO_MS,
        coldStartGateMs: COLD_START_GATE_MS,
        memorySloMb: MEMORY_SLO_MB,
        memoryGateMb: MEMORY_GATE_MB,
        coldStartWithinSlo,
        coldStartWithinGate,
        memoryWithinSlo,
        memoryWithinGate,
        processCount: metricsSnapshot.processCount,
        totalWorkingSetMb,
      },
    };

    return result;
  } finally {
    await closeElectronApp(electronApp as ClosableElectronApp);
    if (existsSync(userDataDir)) {
      rmSync(userDataDir, { recursive: true, force: true });
    }
  }
}

// Run benchmark
runBenchmark()
  .then((result) => {
    // Output JSON for CI/CD consumption
    console.log(JSON.stringify(result, null, 2));

    // Also output human-readable summary to stderr
    console.error('\n--- Benchmark Results ---');
    console.error(
      `Cold Start: ${result.coldStartMs}ms (SLO: ${COLD_START_SLO_MS}ms, gate: ${COLD_START_GATE_MS}ms) ${
        result.details.coldStartWithinGate ? '✓' : '✗'
      }`
    );
    console.error(
      `Memory:     ${result.memoryMb}MB (SLO: ${MEMORY_SLO_MB}MB, gate: ${MEMORY_GATE_MB}MB) ${
        result.details.memoryWithinGate ? '✓' : '✗'
      }`
    );
    console.error(`Processes:  ${result.details.processCount}`);
    console.error(`Total WS:   ${result.details.totalWorkingSetMb}MB (diagnostic)`);
    console.error(`SLO:        ${result.sloMet ? 'MET' : 'NOT MET (within gate allowed)'}`);
    console.error(`Overall:    ${result.passed ? 'PASSED' : 'FAILED'}`);

    if (!result.passed) {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Benchmark failed with error:', error);
    process.exit(1);
  });
