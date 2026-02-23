/**
 * E2E tests for mdxpad using Playwright Electron.
 *
 * These tests validate the core functionality of the application:
 * - Window creation and basic UI
 * - Security settings are correctly applied
 * - Core features work as expected
 */

import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { test, expect } from '@playwright/test';
import { join } from 'node:path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
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
  await electronApp.close();
});

test.describe('mdxpad Application', () => {
  test('should display the main window', async () => {
    // Verify the window is visible
    const title = await page.title();
    expect(title).toBe('mdxpad');
  });

  test('should show mdxpad heading', async () => {
    // Look for the main heading
    const heading = await page.locator('h1').textContent();
    expect(heading).toBe('mdxpad');
  });

  test('should display version information', async () => {
    // Wait for version to be fetched and displayed
    await page.waitForSelector('text=Version');
    const versionText = await page.locator('text=Version').textContent();
    expect(versionText).toContain('Version');
  });

  test('should display platform information', async () => {
    // Verify platform info is shown
    const platformText = await page.locator('text=darwin').textContent();
    expect(platformText).toContain('darwin');
  });

  test('should have mdxpad API exposed via preload', async () => {
    // Verify the preload script exposed the API
    const hasMdxpadApi = await page.evaluate(() => {
      return typeof (window as any).mdxpad !== 'undefined';
    });
    expect(hasMdxpadApi).toBe(true);
  });

  test('should have getVersion method in API', async () => {
    const hasGetVersion = await page.evaluate(() => {
      return typeof (window as any).mdxpad.getVersion === 'function';
    });
    expect(hasGetVersion).toBe(true);
  });

  test('should have getSecurityInfo method in API', async () => {
    const hasGetSecurityInfo = await page.evaluate(() => {
      return typeof (window as any).mdxpad.getSecurityInfo === 'function';
    });
    expect(hasGetSecurityInfo).toBe(true);
  });

  test('should return correct security settings', async () => {
    const securityInfo = await page.evaluate(async () => {
      return (window as any).mdxpad.getSecurityInfo();
    });

    expect(securityInfo.contextIsolation).toBe(true);
    expect(securityInfo.sandbox).toBe(true);
    expect(securityInfo.nodeIntegration).toBe(false);
    expect(securityInfo.webSecurity).toBe(true);
  });

  test('should have platform information in API', async () => {
    const platform = await page.evaluate(() => {
      return (window as any).mdxpad.platform;
    });

    expect(platform.os).toBe('darwin');
    expect(['arm64', 'x64']).toContain(platform.arch);
  });
});
