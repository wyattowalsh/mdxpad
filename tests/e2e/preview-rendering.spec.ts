/**
 * E2E tests for markdown preview rendering.
 *
 * Validates that basic markdown headings typed in the editor render in the preview iframe.
 */

import type { ElectronApplication, Page } from 'playwright';
import { test, expect } from '@playwright/test';
import { launchMdxpad, safeCloseElectronApp } from './utils/electron-lifecycle';

let electronApp: ElectronApplication;
let page: Page;
let userDataDir: string | null = null;

async function readEditorContent(): Promise<string> {
  const editorContent = page.locator('.cm-content').first();
  const text = (await editorContent.textContent()) ?? '';
  return text.replace(/\u200b/g, '');
}

async function replaceEditorContent(content: string): Promise<void> {
  const editorContent = page.locator('.cm-content').first();
  await expect(editorContent).toBeVisible();
  await editorContent.click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.insertText(content);

  await expect.poll(() => readEditorContent()).toBe(content);
}

test.beforeAll(async () => {
  const launched = await launchMdxpad({ userDataDirSuffix: 'preview-rendering' });
  electronApp = launched.app;
  userDataDir = launched.userDataDir;

  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('[data-testid="status-bar"]');
});

test.afterAll(async () => {
  await safeCloseElectronApp(electronApp, userDataDir);
  userDataDir = null;
});

test.describe('Preview Rendering E2E', () => {
  test('typing "# Heading" renders an h1 in preview', async () => {
    await replaceEditorContent('# Heading');

    const previewHeading = page.frameLocator('iframe[title="MDX Preview"]').locator('h1');
    await expect(previewHeading).toHaveText('Heading', { timeout: 15_000 });
  });
});
