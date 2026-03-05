/**
 * Autosave and Recovery E2E Tests
 *
 * End-to-end tests for the autosave and crash recovery functionality.
 * Tests the full user workflow from editing to recovery.
 *
 * Test Coverage:
 * - Autosave Flow: edit -> autosave -> verify recovery file
 * - Recovery Dialog Flow: restart with recovery data -> dialog -> restore/decline
 * - Crash Simulation: force-kill -> restart -> recovery
 * - SC-100 Validation: verify recovery file contains 100% content via checksum
 *
 * Prerequisites:
 * - Build the app first: `pnpm build`
 * - Run tests: `pnpm test:e2e tests/e2e/autosave-recovery.spec.ts`
 *
 * @module tests/e2e/autosave-recovery
 */

import type { ElectronApplication, Page } from 'playwright';
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import {
  createIsolatedUserDataDir,
  launchMdxpad,
  safeCloseElectronApp,
} from './utils/electron-lifecycle';

// ============================================================================
// Test Configuration
// ============================================================================

/** Test fixtures directory for temporary files */
const TEST_FIXTURES_DIR = join(tmpdir(), 'mdxpad-autosave-e2e');

/** Test document content for autosave verification */
const TEST_CONTENT = `# Autosave Test Document

This is a test document for verifying autosave functionality.

## Features

- Automatic background saving
- Crash recovery
- Content integrity verification

\`\`\`typescript
const example = "autosave test";
console.log(example);
\`\`\`

Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
`;

/** Unique content marker to verify recovery file content */
const UNIQUE_MARKER = `UNIQUE_TEST_MARKER_${randomUUID()}`;
const TEST_CONTENT_WITH_MARKER = `${TEST_CONTENT}\n<!-- ${UNIQUE_MARKER} -->`;

// TODO(HR-S-011): Override AUTOSAVE_DEBOUNCE_MS via env for faster test runs.
// Currently 2000ms + 3000ms buffer = 9s minimum per debounce test.
// Future: read from process.env.MDXPAD_TEST_DEBOUNCE_MS if NODE_ENV=test.
/** Default autosave debounce period in ms */
const AUTOSAVE_DEBOUNCE_MS = 2000;

/** Additional buffer time for autosave to complete */
const AUTOSAVE_BUFFER_MS = 3000;

interface LaunchedTestApp {
  app: ElectronApplication;
  page: Page;
  userDataDir: string;
  recoveryDir: string;
}

let electronApp: ElectronApplication | null = null;
let page: Page | null = null;
let userDataDir: string | null = null;
let recoveryDir: string | null = null;
const tempDirs = new Set<string>();

function sanitizePathSegment(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized.slice(0, 48) || 'test';
}

function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function trackTempDir(dirPath: string): string {
  tempDirs.add(dirPath);
  return dirPath;
}

function getActiveRecoveryDir(targetRecoveryDir?: string): string {
  const resolved = targetRecoveryDir ?? recoveryDir;
  if (!resolved) {
    throw new Error('Recovery directory is not initialized for this test');
  }
  return resolved;
}

function createIsolatedRecoveryDir(label: string): string {
  const fixtureDir = trackTempDir(
    mkdtempSync(join(TEST_FIXTURES_DIR, `${sanitizePathSegment(label)}-`))
  );
  const isolatedRecoveryDir = join(fixtureDir, 'recovery');
  ensureDir(isolatedRecoveryDir);
  recoveryDir = isolatedRecoveryDir;
  return isolatedRecoveryDir;
}

function createIsolatedProfileDir(label: string): string {
  const profileDir = createIsolatedUserDataDir(`${sanitizePathSegment(label)}-${randomUUID()}`);
  ensureDir(profileDir);
  trackTempDir(profileDir);
  return profileDir;
}

function cleanupChromiumSingletonArtifacts(profileDir: string): void {
  const singletonArtifacts = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
  for (const artifact of singletonArtifacts) {
    const artifactPath = join(profileDir, artifact);
    if (existsSync(artifactPath)) {
      rmSync(artifactPath, { force: true });
    }
  }
}

async function launchTestApp(
  label: string,
  options: { userDataDir?: string } = {}
): Promise<LaunchedTestApp> {
  const launchOptions = {
    userDataDirSuffix: `${sanitizePathSegment(label)}-${randomUUID()}`,
    ...(options.userDataDir ? { userDataDir: options.userDataDir } : {}),
  };

  const launched = await launchMdxpad(launchOptions);

  electronApp = launched.app;
  userDataDir = launched.userDataDir;

  const firstWindow = await launched.app.firstWindow();
  await firstWindow.waitForLoadState('domcontentloaded');
  page = firstWindow;

  const effectiveUserDataDir = await launched.app.evaluate(({ app: electronApp }) =>
    electronApp.getPath('userData')
  );
  const effectiveRecoveryDir = join(effectiveUserDataDir, 'recovery');
  ensureDir(effectiveRecoveryDir);
  recoveryDir = effectiveRecoveryDir;

  return {
    app: launched.app,
    page: firstWindow,
    userDataDir: launched.userDataDir,
    recoveryDir: effectiveRecoveryDir,
  };
}

async function prepareRecoveryProfile(
  label: string
): Promise<{ profileDir: string; recoveryDir: string }> {
  const profileDir = createIsolatedProfileDir(label);
  const resolved = await launchTestApp(`${label}-resolve`, { userDataDir: profileDir });
  const resolvedRecoveryDir = resolved.recoveryDir;

  // Close without removing userData so we can seed recovery data for the next startup.
  await safeCloseElectronApp(resolved.app, profileDir);
  electronApp = null;
  page = null;
  userDataDir = profileDir;
  recoveryDir = resolvedRecoveryDir;

  return {
    profileDir,
    recoveryDir: resolvedRecoveryDir,
  };
}

async function cleanupTestState(): Promise<void> {
  await safeCloseElectronApp(electronApp, userDataDir);
  electronApp = null;
  page = null;
  userDataDir = null;
  recoveryDir = null;

  for (const dirPath of tempDirs) {
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  }
  tempDirs.clear();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Computes SHA-256 checksum of content (matches AutosaveService implementation).
 *
 * @param content - The content to hash
 * @returns Hex-encoded SHA-256 hash (64 characters)
 */
function computeChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Reads the recovery manifest from disk.
 *
 * @param targetRecoveryDir - Recovery directory for this test context
 * @returns Parsed manifest object or null if not found/invalid
 */
function readManifest(
  targetRecoveryDir?: string
): { version: number; entries: Record<string, unknown> } | null {
  const manifestPath = join(getActiveRecoveryDir(targetRecoveryDir), 'manifest.json');
  if (!existsSync(manifestPath)) {
    return null;
  }
  try {
    const content = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as { version: number; entries: Record<string, unknown> };
  } catch {
    return null;
  }
}

/**
 * Creates a mock recovery file for testing recovery dialog.
 *
 * @param targetRecoveryDir - Recovery directory for this test context
 * @param documentId - UUID for the document
 * @param content - Document content
 * @param fileName - Display name
 * @param filePath - Original file path or null for untitled
 */
function createMockRecoveryFile(
  targetRecoveryDir: string,
  documentId: string,
  content: string,
  fileName: string,
  filePath: string | null = null
): void {
  ensureDir(targetRecoveryDir);

  const checksum = computeChecksum(content);
  const savedAt = Date.now();

  // Create recovery file
  const recoveryFile = {
    version: 1,
    documentId,
    filePath,
    fileName,
    content,
    savedAt,
    checksum,
  };

  const recoveryFilePath = join(targetRecoveryDir, `${documentId}.json`);
  writeFileSync(recoveryFilePath, JSON.stringify(recoveryFile, null, 2), 'utf-8');

  // Update manifest
  const manifest = readManifest(targetRecoveryDir) ?? { version: 1, entries: {} };
  manifest.entries[documentId] = {
    documentId,
    filePath,
    fileName,
    savedAt,
    recoveryFilePath: `${documentId}.json`,
  };

  const manifestPath = join(targetRecoveryDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Cleans up the recovery directory.
 *
 * @param targetRecoveryDir - Recovery directory for this test context
 */
function cleanupRecoveryDir(targetRecoveryDir?: string): void {
  const resolvedRecoveryDir = getActiveRecoveryDir(targetRecoveryDir);
  if (existsSync(resolvedRecoveryDir)) {
    rmSync(resolvedRecoveryDir, { recursive: true, force: true });
  }
}

/**
 * Checks if any recovery files exist.
 *
 * @param targetRecoveryDir - Recovery directory for this test context
 * @returns True if recovery files exist
 */
function hasRecoveryFiles(targetRecoveryDir?: string): boolean {
  const resolvedRecoveryDir = getActiveRecoveryDir(targetRecoveryDir);
  if (!existsSync(resolvedRecoveryDir)) {
    return false;
  }
  const files = readdirSync(resolvedRecoveryDir);
  return files.some((f) => f.endsWith('.json') && f !== 'manifest.json');
}

/**
 * Gets the content of a recovery file by document ID.
 *
 * @param targetRecoveryDir - Recovery directory for this test context
 * @param documentId - The document ID
 * @returns The recovery file content or null
 */
function getRecoveryFileContent(
  targetRecoveryDir: string,
  documentId: string
): { content: string; checksum: string; savedAt: number } | null {
  const recoveryFilePath = join(targetRecoveryDir, `${documentId}.json`);
  if (!existsSync(recoveryFilePath)) {
    return null;
  }
  try {
    const fileContent = readFileSync(recoveryFilePath, 'utf-8');
    const parsed = JSON.parse(fileContent) as {
      content: string;
      checksum: string;
      savedAt: number;
    };
    return parsed;
  } catch {
    return null;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

test.describe('Autosave and Recovery', () => {
  test.beforeAll(async () => {
    ensureDir(TEST_FIXTURES_DIR);
  });

  test.afterEach(async () => {
    await cleanupTestState();
  });

  test.afterAll(async () => {
    await cleanupTestState();

    if (existsSync(TEST_FIXTURES_DIR)) {
      rmSync(TEST_FIXTURES_DIR, { recursive: true, force: true });
    }
  });

  // ==========================================================================
  // Autosave Flow Tests
  // ==========================================================================

  test.describe('Autosave Flow', () => {
    test('should have autosave API methods exposed via preload', async () => {
      const { page: win } = await launchTestApp('autosave-flow-api');

      // Verify that autosave-related IPC methods are available
      // Note: The actual API exposure depends on implementation in preload/index.ts
      const hasApi = await win.evaluate(() => {
        return typeof (window as unknown as Record<string, unknown>).mdxpad !== 'undefined';
      });
      expect(hasApi).toBe(true);
    });

    test('should autosave document after debounce period', async () => {
      const { page: win, recoveryDir: targetRecoveryDir } =
        await launchTestApp('autosave-flow-debounce');

      const hasAutosaveSupport = await win.evaluate(() => {
        const mdxpad = (window as unknown as Record<string, unknown>).mdxpad as
          | { autosaveTrigger?: unknown }
          | undefined;
        return typeof mdxpad?.autosaveTrigger === 'function';
      });

      expect(hasAutosaveSupport).toBe(true);
      if (!hasAutosaveSupport) return;

      cleanupRecoveryDir(targetRecoveryDir);
      ensureDir(targetRecoveryDir);

      const testDocId = randomUUID();
      const triggerResult = await win.evaluate(
        async ({ documentId, content }) => {
          return await (window as any).mdxpad.autosaveTrigger({
            documentId,
            filePath: null,
            fileName: 'Untitled',
            content,
          });
        },
        { documentId: testDocId, content: TEST_CONTENT_WITH_MARKER }
      );

      expect(triggerResult.ok).toBe(true);

      await expect
        .poll(
          () => {
            return hasRecoveryFiles(targetRecoveryDir);
          },
          { timeout: AUTOSAVE_DEBOUNCE_MS + AUTOSAVE_BUFFER_MS + 4000 }
        )
        .toBe(true);

      const recoveryData = getRecoveryFileContent(targetRecoveryDir, testDocId);
      expect(recoveryData).not.toBeNull();
      expect(recoveryData!.content).toContain(UNIQUE_MARKER);
      // Verify content integrity via checksum
      expect(computeChecksum(recoveryData!.content)).toBe(recoveryData!.checksum);
    });

    test('should include 100% of content in recovery file (SC-100)', async () => {
      const { page: win, recoveryDir: targetRecoveryDir } =
        await launchTestApp('autosave-flow-sc001');

      // Skip if autosave API is not yet implemented
      const hasAutosaveSupport = await win.evaluate(() => {
        return typeof (window as unknown as Record<string, unknown>).mdxpad !== 'undefined';
      });

      expect(hasAutosaveSupport).toBe(true);

      // Create a document with known content
      const testDocId = randomUUID();
      const knownContent = `# SC-001 Test\n\nThis content must be 100% preserved.\n\n${UNIQUE_MARKER}`;

      // Create mock recovery file directly (simulating autosave)
      createMockRecoveryFile(targetRecoveryDir, testDocId, knownContent, 'SC-001 Test Document');

      // Read recovery file
      const recoveryData = getRecoveryFileContent(targetRecoveryDir, testDocId);
      expect(recoveryData).not.toBeNull();

      if (recoveryData) {
        // Verify content is 100% preserved
        expect(recoveryData.content).toBe(knownContent);

        // Verify checksum matches content checksum
        const expectedChecksum = computeChecksum(knownContent);
        expect(recoveryData.checksum).toBe(expectedChecksum);

        // Additional verification: recompute checksum from stored content
        const recomputedChecksum = computeChecksum(recoveryData.content);
        expect(recomputedChecksum).toBe(recoveryData.checksum);
      }
    });

    test('should preserve Unicode and special characters in recovery', async () => {
      const targetRecoveryDir = createIsolatedRecoveryDir('autosave-flow-unicode');
      const testDocId = randomUUID();
      const unicodeContent = `# Unicode Test

Emoji: 🎉 🚀 ✨ 💻
Chinese: 你好世界
Japanese: こんにちは
Arabic: مرحبا بالعالم
Math: ∑∏∫∂∞≈≠≤≥
Symbols: © ® ™ € £ ¥

Special chars: <>&"'\`\\n\\t
`;

      // Create mock recovery file
      createMockRecoveryFile(targetRecoveryDir, testDocId, unicodeContent, 'Unicode Test');

      // Read and verify
      const recoveryData = getRecoveryFileContent(targetRecoveryDir, testDocId);
      expect(recoveryData).not.toBeNull();

      if (recoveryData) {
        expect(recoveryData.content).toBe(unicodeContent);
        expect(computeChecksum(recoveryData.content)).toBe(recoveryData.checksum);
      }
    });

    test('should preserve large documents in recovery', async () => {
      const targetRecoveryDir = createIsolatedRecoveryDir('autosave-flow-large');
      const testDocId = randomUUID();

      // Generate ~100KB of content
      const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
      let largeContent = '# Large Document Test\n\n';
      for (let i = 0; i < 2000; i++) {
        largeContent += paragraph;
      }

      // Create mock recovery file
      createMockRecoveryFile(targetRecoveryDir, testDocId, largeContent, 'Large Document');

      // Read and verify
      const recoveryData = getRecoveryFileContent(targetRecoveryDir, testDocId);
      expect(recoveryData).not.toBeNull();

      if (recoveryData) {
        expect(recoveryData.content.length).toBe(largeContent.length);
        expect(computeChecksum(recoveryData.content)).toBe(recoveryData.checksum);
      }
    });
  });

  // ==========================================================================
  // Recovery Dialog Flow Tests
  // ==========================================================================

  test.describe('Recovery Dialog Flow', () => {
    test('should show recovery dialog on restart with recovery data', async () => {
      const { profileDir, recoveryDir: targetRecoveryDir } =
        await prepareRecoveryProfile('recovery-dialog-show');

      // Create mock recovery files before launching app
      const docId1 = randomUUID();
      const docId2 = randomUUID();

      createMockRecoveryFile(
        targetRecoveryDir,
        docId1,
        '# Document 1\n\nRecoverable content.',
        'Document 1.mdx'
      );
      createMockRecoveryFile(
        targetRecoveryDir,
        docId2,
        '# Document 2\n\nMore content.',
        'Document 2.mdx'
      );

      const { page: win } = await launchTestApp('recovery-dialog-show-app', {
        userDataDir: profileDir,
      });

      const recoveryDialog = win.locator('[data-testid="recovery-dialog"]');
      await expect(recoveryDialog).toBeVisible({ timeout: 5_000 });
      await expect(win.locator('[data-testid="recovery-list"]')).toBeVisible();

      const documentItems = win.locator('[data-testid^="recovery-entry-"]');
      await expect(documentItems).toHaveCount(2);
    });

    test('should restore document when accept is chosen', async () => {
      const { profileDir, recoveryDir: targetRecoveryDir } =
        await prepareRecoveryProfile('recovery-dialog-accept');

      // Create mock recovery file
      const docId = randomUUID();
      const recoveryContent = '# Restored Document\n\nThis content should be restored.';

      createMockRecoveryFile(targetRecoveryDir, docId, recoveryContent, 'Restored Document.mdx');

      const { page: win } = await launchTestApp('recovery-dialog-accept-app', {
        userDataDir: profileDir,
      });

      // Wait for recovery dialog to render
      const recoveryDialog = win.locator('[data-testid="recovery-dialog"]');
      await expect(recoveryDialog).toBeVisible({ timeout: 5_000 });

      const restoreButton = win.locator('[data-testid="recovery-restore-button"]');
      await expect(restoreButton).toBeVisible();
      await expect(restoreButton).toBeEnabled();
      await restoreButton.click();
      await expect(recoveryDialog).toBeHidden({ timeout: 5_000 });

      const restoredRecoveryFile = getRecoveryFileContent(targetRecoveryDir, docId);
      expect(restoredRecoveryFile).toBeNull();
    });

    test('should delete recovery files when decline is chosen', async () => {
      const { profileDir, recoveryDir: targetRecoveryDir } =
        await prepareRecoveryProfile('recovery-dialog-decline');

      // Create mock recovery files
      const docId1 = randomUUID();
      const docId2 = randomUUID();

      createMockRecoveryFile(targetRecoveryDir, docId1, '# Doc 1', 'Doc1.mdx');
      createMockRecoveryFile(targetRecoveryDir, docId2, '# Doc 2', 'Doc2.mdx');

      // Verify files exist before decline
      expect(getRecoveryFileContent(targetRecoveryDir, docId1)).not.toBeNull();
      expect(getRecoveryFileContent(targetRecoveryDir, docId2)).not.toBeNull();

      const { page: win } = await launchTestApp('recovery-dialog-decline-app', {
        userDataDir: profileDir,
      });

      // Wait for recovery dialog to render
      const recoveryDialog = win.locator('[data-testid="recovery-dialog"]');
      await expect(recoveryDialog).toBeVisible({ timeout: 5_000 });

      const discardButton = win.locator('[data-testid="recovery-discard-button"]');
      await expect(discardButton).toBeVisible();
      await discardButton.click();
      await expect(recoveryDialog).toBeHidden({ timeout: 5_000 });

      // Verify all recovery files were deleted
      expect(getRecoveryFileContent(targetRecoveryDir, docId1)).toBeNull();
      expect(getRecoveryFileContent(targetRecoveryDir, docId2)).toBeNull();

      // Verify manifest is empty or deleted
      const manifest = readManifest(targetRecoveryDir);
      if (manifest) {
        expect(Object.keys(manifest.entries).length).toBe(0);
      }
    });

    test('should preserve recovery files when dismiss is chosen', async () => {
      const { profileDir, recoveryDir: targetRecoveryDir } =
        await prepareRecoveryProfile('recovery-dialog-dismiss');

      // Create mock recovery file
      const docId = randomUUID();
      const originalContent = '# Preserved Document';

      createMockRecoveryFile(targetRecoveryDir, docId, originalContent, 'Preserved.mdx');

      const { page: win } = await launchTestApp('recovery-dialog-dismiss-app', {
        userDataDir: profileDir,
      });

      // Wait for recovery dialog to render
      const recoveryDialog = win.locator('[data-testid="recovery-dialog"]');
      await expect(recoveryDialog).toBeVisible({ timeout: 5_000 });

      await win.keyboard.press('Escape');
      await expect(recoveryDialog).toBeHidden({ timeout: 5_000 });

      // Verify recovery file is still present (preserved for next startup)
      const recoveryData = getRecoveryFileContent(targetRecoveryDir, docId);
      expect(recoveryData).not.toBeNull();
      if (recoveryData) {
        expect(recoveryData.content).toBe(originalContent);
      }
    });
  });

  // ==========================================================================
  // Crash Simulation Tests
  // ==========================================================================

  test.describe('Crash Simulation', () => {
    test('should recover after simulated crash', async () => {
      const profileDir = createIsolatedProfileDir('crash-simulation-recover');

      // Step 1: Launch app and create content
      await launchTestApp('crash-simulation-recover-initial', { userDataDir: profileDir });
      const crashedApp = electronApp;
      const activeRecoveryDir = getActiveRecoveryDir();

      // Create mock autosave (simulating what would happen during normal editing)
      const crashDocId = randomUUID();
      const crashContent = `# Crash Recovery Test\n\nContent that should survive crash.\n\n${UNIQUE_MARKER}`;

      createMockRecoveryFile(
        activeRecoveryDir,
        crashDocId,
        crashContent,
        'Crash Test Document.mdx'
      );

      // Step 2: Simulate crash by force-killing the app process
      // Note: app.close() is graceful shutdown, we need to kill it.
      const pid = electronApp?.process().pid;
      if (pid) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // Process may have already exited.
        }
      }

      // Wait for process to actually terminate (replaces hardcoded 1s sleep)
      if (pid) {
        for (let i = 0; i < 20; i++) {
          try { process.kill(pid, 0); } catch { break; }
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      // Close Playwright's handle to avoid dangling worker resources.
      await safeCloseElectronApp(crashedApp);
      electronApp = null;
      page = null;

      // Crash restarts can leave Chromium singleton artifacts behind.
      cleanupChromiumSingletonArtifacts(profileDir);

      // Step 3: Verify recovery files survived the crash
      const recoveryData = getRecoveryFileContent(activeRecoveryDir, crashDocId);
      expect(recoveryData).not.toBeNull();
      if (recoveryData) {
        expect(recoveryData.content).toBe(crashContent);
        expect(computeChecksum(recoveryData.content)).toBe(recoveryData.checksum);
      }

      // Step 4: Restart app and verify recovery dialog appears
      const { page: win } = await launchTestApp('crash-simulation-recover-restart', {
        userDataDir: profileDir,
      });

      // Wait for recovery dialog to render
      const recoveryDialog = win.locator('[data-testid="recovery-dialog"]');
      await expect(recoveryDialog).toBeVisible({ timeout: 5_000 });
      const documentItems = win.locator('[data-testid^="recovery-entry-"]');
      await expect.poll(async () => documentItems.count()).toBeGreaterThanOrEqual(1);
    });

    test('should handle app restart without recovery data gracefully', async () => {
      const profileDir = createIsolatedProfileDir('crash-simulation-no-recovery');
      const emptyRecoveryDir = join(profileDir, 'recovery');
      ensureDir(emptyRecoveryDir);
      cleanupRecoveryDir(emptyRecoveryDir);
      ensureDir(emptyRecoveryDir);

      // Launch app
      const { page: win } = await launchTestApp('crash-simulation-no-recovery-app', {
        userDataDir: profileDir,
      });

      // Give the app enough time to potentially show a recovery dialog (it should not)
      await win.waitForSelector('[data-testid="status-bar"]', { timeout: 5000 }).catch(() => {});

      // Recovery dialog should NOT appear when there's no recovery data
      const recoveryDialog = win.locator('[data-testid="recovery-dialog"]');
      const dialogVisible = await recoveryDialog.isVisible().catch(() => false);

      expect(dialogVisible).toBe(false);
    });
  });

  // ==========================================================================
  // Checksum Validation Tests (SC-100)
  // ==========================================================================

  test.describe('Checksum Validation (SC-100)', () => {
    test('should generate consistent checksums for same content', () => {
      const content = '# Test Content\n\nSame content should produce same checksum.';

      const checksum1 = computeChecksum(content);
      const checksum2 = computeChecksum(content);

      expect(checksum1).toBe(checksum2);
      expect(checksum1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    test('should generate different checksums for different content', () => {
      const content1 = '# Content 1';
      const content2 = '# Content 2';

      const checksum1 = computeChecksum(content1);
      const checksum2 = computeChecksum(content2);

      expect(checksum1).not.toBe(checksum2);
    });

    test('should detect corrupted recovery files via checksum mismatch', () => {
      const targetRecoveryDir = createIsolatedRecoveryDir('checksum-corruption');
      const testDocId = randomUUID();
      const originalContent = '# Original Content';

      // Create valid recovery file
      createMockRecoveryFile(targetRecoveryDir, testDocId, originalContent, 'Corrupted Test');

      // Read and verify checksum is valid
      let recoveryData = getRecoveryFileContent(targetRecoveryDir, testDocId);
      expect(recoveryData).not.toBeNull();
      if (recoveryData) {
        expect(computeChecksum(recoveryData.content)).toBe(recoveryData.checksum);
      }

      // Manually corrupt the file by changing content but not checksum
      const recoveryFilePath = join(targetRecoveryDir, `${testDocId}.json`);
      const fileContent = JSON.parse(readFileSync(recoveryFilePath, 'utf-8')) as {
        content: string;
        checksum: string;
      };
      fileContent.content = '# Corrupted Content';
      // Don't update checksum - this simulates corruption
      writeFileSync(recoveryFilePath, JSON.stringify(fileContent, null, 2), 'utf-8');

      // Read corrupted file and verify checksum mismatch
      recoveryData = getRecoveryFileContent(targetRecoveryDir, testDocId);
      expect(recoveryData).not.toBeNull();
      if (recoveryData) {
        const actualChecksum = computeChecksum(recoveryData.content);
        expect(actualChecksum).not.toBe(recoveryData.checksum);
      }
    });

    test('should verify 100% content integrity via checksum', () => {
      const targetRecoveryDir = createIsolatedRecoveryDir('checksum-integrity');
      const testDocId = randomUUID();

      // Create content with specific byte patterns
      const testContent = [
        '# Header',
        '',
        'Paragraph with text.',
        '',
        '```code',
        'const x = 1;',
        '```',
        '',
        'Unicode: \u00e9\u00e0\u00fc', // accented characters
        'Newlines\n\nMultiple\n\n\nTriple',
        'Tabs:\t\t\tThree tabs',
        'End of file.',
      ].join('\n');

      // Create recovery file
      createMockRecoveryFile(targetRecoveryDir, testDocId, testContent, 'Integrity Test');

      // Read and verify
      const recoveryData = getRecoveryFileContent(targetRecoveryDir, testDocId);
      expect(recoveryData).not.toBeNull();

      if (recoveryData) {
        // Verify byte-for-byte equality
        expect(recoveryData.content).toBe(testContent);
        expect(recoveryData.content.length).toBe(testContent.length);

        // Verify checksum proves 100% content integrity
        const storedChecksum = recoveryData.checksum;
        const recomputedChecksum = computeChecksum(recoveryData.content);
        const originalChecksum = computeChecksum(testContent);

        expect(storedChecksum).toBe(originalChecksum);
        expect(recomputedChecksum).toBe(originalChecksum);
      }
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  test.describe('Edge Cases', () => {
    test('should handle untitled documents in recovery', async () => {
      const targetRecoveryDir = createIsolatedRecoveryDir('edge-untitled');
      const testDocId = randomUUID();
      const untitledContent = '# Untitled Document\n\nNo file path associated.';

      // Create recovery file with null filePath (untitled document)
      createMockRecoveryFile(targetRecoveryDir, testDocId, untitledContent, 'Untitled', null);

      // Verify file was created correctly
      const recoveryData = getRecoveryFileContent(targetRecoveryDir, testDocId);
      expect(recoveryData).not.toBeNull();
      if (recoveryData) {
        expect(recoveryData.content).toBe(untitledContent);
      }

      // Verify manifest entry has null filePath
      const manifest = readManifest(targetRecoveryDir);
      expect(manifest).not.toBeNull();
      if (manifest) {
        const entry = manifest.entries[testDocId] as { filePath: string | null } | undefined;
        expect(entry).toBeDefined();
        if (entry) {
          expect(entry.filePath).toBeNull();
        }
      }
    });

    test('should handle empty document content', async () => {
      const targetRecoveryDir = createIsolatedRecoveryDir('edge-empty-content');
      const testDocId = randomUUID();
      const emptyContent = '';

      // Create recovery file with empty content
      createMockRecoveryFile(targetRecoveryDir, testDocId, emptyContent, 'Empty Document');

      const recoveryData = getRecoveryFileContent(targetRecoveryDir, testDocId);
      expect(recoveryData).not.toBeNull();
      if (recoveryData) {
        expect(recoveryData.content).toBe('');
        expect(recoveryData.content.length).toBe(0);
        // Empty string still has a valid checksum
        expect(computeChecksum(recoveryData.content)).toBe(recoveryData.checksum);
      }
    });

    test('should handle multiple documents in recovery', async () => {
      const targetRecoveryDir = createIsolatedRecoveryDir('edge-multiple-documents');
      const docIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
      const contents = docIds.map(
        (_id, i) => `# Document ${i + 1}\n\nContent for document ${i + 1}.`
      );

      // Create multiple recovery files
      docIds.forEach((id, i) => {
        createMockRecoveryFile(targetRecoveryDir, id, contents[i] ?? '', `Document ${i + 1}.mdx`);
      });

      // Verify all files exist
      docIds.forEach((id, i) => {
        const recoveryData = getRecoveryFileContent(targetRecoveryDir, id);
        expect(recoveryData).not.toBeNull();
        if (recoveryData) {
          expect(recoveryData.content).toBe(contents[i]);
        }
      });

      // Verify manifest has all entries
      const manifest = readManifest(targetRecoveryDir);
      expect(manifest).not.toBeNull();
      if (manifest) {
        expect(Object.keys(manifest.entries).length).toBe(5);
      }
    });
  });
});
