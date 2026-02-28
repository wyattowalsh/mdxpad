/**
 * Benchmark Harness
 *
 * Shared utility for running performance benchmarks with timing statistics.
 * Reports average, p50, p95, min, max and validates thresholds.
 *
 * @module scripts/bench-harness
 */

// =============================================================================
// TYPES
// =============================================================================

interface BenchmarkSpec {
  readonly name: string;
  readonly thresholdMs: number;
  readonly warmupIterations?: number;
  readonly iterations?: number;
  readonly fn: () => void | Promise<void>;
}

interface BenchmarkResult {
  readonly name: string;
  readonly thresholdMs: number;
  readonly samples: readonly number[];
  readonly avgMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly passed: boolean;
}

interface BenchmarkSuiteResult {
  readonly results: readonly BenchmarkResult[];
  readonly allPassed: boolean;
  readonly timestamp: string;
}

// =============================================================================
// STATISTICS
// =============================================================================

function percentile(sorted: readonly number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

function computeStats(samples: readonly number[]): {
  avg: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
} {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    avg: sum / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
}

// =============================================================================
// RUNNER
// =============================================================================

async function runSingleBenchmark(spec: BenchmarkSpec): Promise<BenchmarkResult> {
  const warmup = spec.warmupIterations ?? 5;
  const iterations = spec.iterations ?? 100;

  // Warmup
  for (let i = 0; i < warmup; i++) {
    await spec.fn();
  }

  // Timed iterations
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await spec.fn();
    samples.push(performance.now() - start);
  }

  const stats = computeStats(samples);

  return {
    name: spec.name,
    thresholdMs: spec.thresholdMs,
    samples,
    avgMs: Math.round(stats.avg * 100) / 100,
    p50Ms: Math.round(stats.p50 * 100) / 100,
    p95Ms: Math.round(stats.p95 * 100) / 100,
    minMs: Math.round(stats.min * 100) / 100,
    maxMs: Math.round(stats.max * 100) / 100,
    passed: stats.p95 <= spec.thresholdMs,
  };
}

/**
 * Run a suite of benchmarks, report results, and exit with code 1 if any fail.
 */
export async function runBenchmarkSuite(
  suiteName: string,
  specs: readonly BenchmarkSpec[]
): Promise<void> {
  console.error(`\n=== ${suiteName} ===\n`);

  const results: BenchmarkResult[] = [];

  for (const spec of specs) {
    console.error(`  Running: ${spec.name} ...`);
    const result = await runSingleBenchmark(spec);
    results.push(result);

    const status = result.passed ? 'PASS' : 'FAIL';
    console.error(
      `    [${status}] avg=${result.avgMs}ms p50=${result.p50Ms}ms p95=${result.p95Ms}ms ` +
        `min=${result.minMs}ms max=${result.maxMs}ms (threshold: ${result.thresholdMs}ms)`
    );
  }

  const allPassed = results.every((r) => r.passed);

  const suiteResult: BenchmarkSuiteResult = {
    results,
    allPassed,
    timestamp: new Date().toISOString(),
  };

  // JSON to stdout for CI
  console.log(JSON.stringify(suiteResult, null, 2));

  console.error(`\n--- ${suiteName} Summary ---`);
  console.error(`  Total: ${results.length} benchmarks`);
  console.error(`  Passed: ${results.filter((r) => r.passed).length}`);
  console.error(`  Failed: ${results.filter((r) => !r.passed).length}`);
  console.error(`  Overall: ${allPassed ? 'PASSED' : 'FAILED'}\n`);

  if (!allPassed) {
    process.exit(1);
  }
}
