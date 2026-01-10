/**
 * Performance benchmark tests for file operations.
 *
 * These tests verify that file operations meet the performance budgets
 * defined in the Constitution (Article V):
 * - SC-001: 1MB file opens in < 500ms
 * - SC-002: 10MB file opens in < 2s
 */

import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from 'playwright';
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Test configuration
const TEMP_DIR = join(tmpdir(), 'mdxpad-perf-test');
const FILE_1MB = join(TEMP_DIR, 'test-1mb.mdx');
const FILE_10MB = join(TEMP_DIR, 'test-10mb.mdx');

// Performance budgets from Constitution Article V
const BUDGET_1MB_MS = 500;
const BUDGET_10MB_MS = 2000;

// File sizes in bytes
const SIZE_1MB = 1024 * 1024; // 1 MB
const SIZE_10MB = 10 * 1024 * 1024; // 10 MB

let electronApp: ElectronApplication;
let page: Page;

/**
 * Generate a test file of the specified size.
 * Uses a repeating pattern of MDX-like content for realistic testing.
 */
function generateTestFile(path: string, sizeBytes: number): void {
  // Create a repeating MDX content pattern (~100 bytes per unit)
  const contentUnit = `# Heading

This is a paragraph of text content for performance testing.

\`\`\`typescript
const code = "example";
\`\`\`

`;
  const unitSize = Buffer.byteLength(contentUnit, 'utf8');
  const repeatCount = Math.ceil(sizeBytes / unitSize);

  // Build content by repeating the unit
  let content = '';
  for (let i = 0; i < repeatCount; i++) {
    content += contentUnit;
  }

  // Trim to exact size
  content = content.slice(0, sizeBytes);

  writeFileSync(path, content, 'utf8');
}

test.beforeAll(async () => {
  // Create temp directory if it doesn't exist
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }

  // Generate test files
  console.log('Generating 1MB test file...');
  generateTestFile(FILE_1MB, SIZE_1MB);
  console.log('Generating 10MB test file...');
  generateTestFile(FILE_10MB, SIZE_10MB);

  // Launch Electron app
  const electronPath = join(process.cwd(), 'node_modules', '.bin', 'electron');
  const appPath = join(process.cwd(), 'dist', 'main', 'index.js');

  electronApp = await electron.launch({
    args: [appPath],
    executablePath: electronPath,
  });

  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  // Close Electron app
  await electronApp.close();

  // Clean up test files
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  }
});

test.describe('File Performance Benchmarks', () => {
  test('should have mdxpad.readFile API available', async () => {
    const hasReadFile = await page.evaluate(() => {
      return typeof (window as any).mdxpad?.readFile === 'function';
    });
    expect(hasReadFile).toBe(true);
  });

  test('SC-001: 1MB file opens in < 500ms', async () => {
    const filePath = FILE_1MB;

    // Perform the read and measure time using page.evaluate
    // We use performance.now() in the browser context for accurate timing
    const result = await page.evaluate(async (path: string) => {
      const start = performance.now();
      const fileResult = await (window as any).mdxpad.readFile(path);
      const elapsed = performance.now() - start;

      return {
        elapsed,
        ok: fileResult.ok,
        contentLength: fileResult.ok ? fileResult.value.length : 0,
        error: fileResult.ok ? null : fileResult.error,
      };
    }, filePath);

    // Log performance metrics
    console.log(`1MB file read time: ${result.elapsed.toFixed(2)}ms`);

    // Verify the read succeeded
    expect(result.ok).toBe(true);
    expect(result.contentLength).toBeGreaterThanOrEqual(SIZE_1MB - 100); // Allow small variance

    // Verify performance budget
    expect(result.elapsed).toBeLessThan(BUDGET_1MB_MS);
  });

  test('SC-002: 10MB file opens in < 2s', async () => {
    const filePath = FILE_10MB;

    // Perform the read and measure time using page.evaluate
    const result = await page.evaluate(async (path: string) => {
      const start = performance.now();
      const fileResult = await (window as any).mdxpad.readFile(path);
      const elapsed = performance.now() - start;

      return {
        elapsed,
        ok: fileResult.ok,
        contentLength: fileResult.ok ? fileResult.value.length : 0,
        error: fileResult.ok ? null : fileResult.error,
      };
    }, filePath);

    // Log performance metrics
    console.log(`10MB file read time: ${result.elapsed.toFixed(2)}ms`);

    // Verify the read succeeded
    expect(result.ok).toBe(true);
    expect(result.contentLength).toBeGreaterThanOrEqual(SIZE_10MB - 100); // Allow small variance

    // Verify performance budget
    expect(result.elapsed).toBeLessThan(BUDGET_10MB_MS);
  });

  test('reports accurate file content length', async () => {
    // Additional validation that the file sizes are as expected
    const result1MB = await page.evaluate(async (path: string) => {
      const fileResult = await (window as any).mdxpad.readFile(path);
      return fileResult.ok ? fileResult.value.length : 0;
    }, FILE_1MB);

    const result10MB = await page.evaluate(async (path: string) => {
      const fileResult = await (window as any).mdxpad.readFile(path);
      return fileResult.ok ? fileResult.value.length : 0;
    }, FILE_10MB);

    // Verify file sizes are approximately correct
    expect(result1MB).toBeGreaterThanOrEqual(SIZE_1MB * 0.99);
    expect(result1MB).toBeLessThanOrEqual(SIZE_1MB * 1.01);

    expect(result10MB).toBeGreaterThanOrEqual(SIZE_10MB * 0.99);
    expect(result10MB).toBeLessThanOrEqual(SIZE_10MB * 1.01);
  });
});
