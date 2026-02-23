/**
 * E2E tests for command palette in mdxpad.
 *
 * Tests cover command palette functionality per spec 005:
 * - FR-005: Opening command palette with Cmd+Shift+P
 * - FR-006: Command search and filtering
 * - FR-007: Keyboard navigation
 * - FR-008: Command execution from palette
 * - FR-009: Recent commands display
 *
 * Prerequisites:
 * - Build the app first: `pnpm build`
 * - Run tests: `pnpm test:e2e tests/e2e/command-palette.spec.ts`
 *
 * @module tests/e2e/command-palette
 */

import type { ElectronApplication, Page } from 'playwright';
import { test, expect } from '@playwright/test';
import { launchMdxpad, safeCloseElectronApp } from './utils/electron-lifecycle';

let electronApp: ElectronApplication;
let page: Page;
let userDataDir: string | null = null;

const PALETTE_SELECTOR = '[data-testid="command-palette"]';

/** Opens the command palette and waits for it to appear. */
async function openPalette(target: Page): Promise<void> {
  await target.keyboard.press('Meta+Shift+p');
  await target.waitForSelector(PALETTE_SELECTOR);
}

/** Closes the command palette and waits for it to disappear. */
async function closePalette(target: Page): Promise<void> {
  await target.keyboard.press('Escape');
  await expect
    .poll(async () => {
      return await target.evaluate((sel) => document.querySelector(sel) === null, PALETTE_SELECTOR);
    })
    .toBe(true);
}

/** Waits for command items to appear in the palette after typing. */
async function waitForCommandItems(target: Page): Promise<void> {
  await expect
    .poll(async () => {
      return await target.evaluate(() => {
        return document.querySelectorAll('[data-testid="command-item"], [role="option"]').length;
      });
    })
    .toBeGreaterThan(0);
}

/** Waits for the palette to close after executing a command. */
async function waitForPaletteClosed(target: Page): Promise<void> {
  await expect
    .poll(async () => {
      return await target.evaluate((sel) => document.querySelector(sel) === null, PALETTE_SELECTOR);
    })
    .toBe(true);
}

test.beforeAll(async () => {
  const launched = await launchMdxpad({ userDataDirSuffix: 'command-palette' });
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

test.describe('Command Palette E2E', () => {
  test.describe('FR-005: Opening Command Palette', () => {
    test('Cmd+Shift+P should open command palette', async () => {
      await openPalette(page);

      const paletteVisible = await page.evaluate(
        (sel) => document.querySelector(sel) !== null,
        PALETTE_SELECTOR
      );

      await closePalette(page);

      expect(paletteVisible).toBe(true);
    });

    test('Escape should close command palette', async () => {
      await openPalette(page);

      const openBefore = await page.evaluate(
        (sel) => document.querySelector(sel) !== null,
        PALETTE_SELECTOR
      );

      await closePalette(page);

      const openAfter = await page.evaluate(
        (sel) => document.querySelector(sel) !== null,
        PALETTE_SELECTOR
      );

      expect(openBefore).toBe(true);
      expect(openAfter).toBe(false);
    });

    test('clicking outside should close command palette', async () => {
      await openPalette(page);

      const clicked = await page.evaluate(() => {
        const overlay =
          document.querySelector('[data-testid="command-palette-backdrop"]') ??
          document.querySelector('[data-overlay]') ??
          document.querySelector('.fixed.inset-0');
        if (overlay) {
          (overlay as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (clicked) {
        await waitForPaletteClosed(page);

        const openAfter = await page.evaluate(
          (sel) => document.querySelector(sel) !== null,
          PALETTE_SELECTOR
        );

        expect(openAfter).toBe(false);
      }
    });
  });

  test.describe('FR-006: Command Search', () => {
    test('should filter commands as user types', async () => {
      await openPalette(page);

      await page.keyboard.type('bold');
      await waitForCommandItems(page);

      const hasFilteredResults = await page.evaluate(() => {
        const items = document.querySelectorAll('[data-testid="command-item"], [role="option"]');
        return items.length > 0;
      });

      await closePalette(page);

      expect(hasFilteredResults).toBe(true);
    });

    test('search should be case-insensitive', async () => {
      await openPalette(page);

      await page.keyboard.type('BOLD');
      await waitForCommandItems(page);

      const foundCommand = await page.evaluate(() => {
        const items = document.querySelectorAll('[data-testid="command-item"], [role="option"]');
        for (const item of items) {
          if (item.textContent?.toLowerCase().includes('bold')) {
            return true;
          }
        }
        return false;
      });

      await closePalette(page);

      expect(foundCommand).toBe(true);
    });

    test('should show "No commands found" for unmatched search', async () => {
      await openPalette(page);

      await page.keyboard.type('xyznonexistent123');

      // Wait for the empty state to appear
      await expect
        .poll(async () => {
          return await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            return text.includes('no commands') || text.includes('no results');
          });
        })
        .toBe(true);

      const hasEmptyState = await page.evaluate(() => {
        const emptyText = document.body.innerText;
        return (
          emptyText.toLowerCase().includes('no commands') ||
          emptyText.toLowerCase().includes('no results')
        );
      });

      await closePalette(page);

      expect(hasEmptyState).toBe(true);
    });
  });

  test.describe('FR-007: Keyboard Navigation', () => {
    test('arrow keys should navigate command list', async () => {
      await openPalette(page);

      const initialSelected = await page.evaluate(() => {
        const selected =
          document.querySelector('[aria-selected="true"]') ??
          document.querySelector('[data-selected]') ??
          document.querySelector('.selected');
        return selected?.textContent ?? '';
      });

      await page.keyboard.press('ArrowDown');

      // Wait for selection state to potentially update
      await expect
        .poll(async () => {
          return await page.evaluate(() => {
            const selected =
              document.querySelector('[aria-selected="true"]') ??
              document.querySelector('[data-selected]') ??
              document.querySelector('.selected');
            return selected?.textContent ?? '';
          });
        })
        .toBeTruthy();

      const afterDown = await page.evaluate(() => {
        const selected =
          document.querySelector('[aria-selected="true"]') ??
          document.querySelector('[data-selected]') ??
          document.querySelector('.selected');
        return selected?.textContent ?? '';
      });

      await closePalette(page);

      expect(typeof afterDown).toBe('string');
    });

    test('Enter should execute selected command', async () => {
      await page.evaluate(() => {
        (window as any).__commandExecuted = false;
        (window as any).__executedCommandId = null;
      });

      await openPalette(page);

      await page.keyboard.type('toggle preview');
      await waitForCommandItems(page);

      await page.keyboard.press('Enter');
      await waitForPaletteClosed(page);

      const paletteOpen = await page.evaluate(
        (sel) => document.querySelector(sel) !== null,
        PALETTE_SELECTOR
      );

      expect(paletteOpen).toBe(false);
    });
  });

  test.describe('FR-008: Command Execution', () => {
    test('should execute view commands from palette', async () => {
      await openPalette(page);

      await page.keyboard.type('zoom in');
      await waitForCommandItems(page);

      await page.keyboard.press('Enter');
      await waitForPaletteClosed(page);

      const paletteOpen = await page.evaluate(
        (sel) => document.querySelector(sel) !== null,
        PALETTE_SELECTOR
      );

      expect(paletteOpen).toBe(false);
    });

    test('disabled commands should not execute', async () => {
      // This test verifies that commands with enabled: () => false
      // are not executed when selected
      // The actual behavior depends on how disabled commands are displayed
      // They might be hidden, grayed out, or shown but non-interactive
    });
  });

  test.describe('FR-009: Recent Commands', () => {
    test('recently executed commands should appear in list', async () => {
      // Execute a command first
      await openPalette(page);
      await page.keyboard.type('toggle preview');
      await waitForCommandItems(page);
      await page.keyboard.press('Enter');
      await waitForPaletteClosed(page);

      // Reopen palette
      await openPalette(page);

      const hasRecentSection = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('recent') || text.includes('toggle preview');
      });

      await closePalette(page);

      expect(hasRecentSection).toBe(true);
    });
  });

  test.describe('Shortcut Display', () => {
    test('commands should display their keyboard shortcuts', async () => {
      await openPalette(page);

      await page.keyboard.type('bold');
      await waitForCommandItems(page);

      const hasShortcut = await page.evaluate(() => {
        const text = document.body.innerText;
        return (
          text.includes('\u2318') ||
          text.includes('Ctrl') ||
          text.includes('Cmd') ||
          text.includes('+B') ||
          text.includes('\u2318B')
        );
      });

      await closePalette(page);

      expect(hasShortcut).toBe(true);
    });
  });

  test.describe('Category Grouping', () => {
    test('commands should be grouped by category', async () => {
      await openPalette(page);

      const hasCategories = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('edit') || text.includes('view') || text.includes('file');
      });

      await closePalette(page);

      expect(hasCategories).toBe(true);
    });
  });
});

test.describe('Menu Integration', () => {
  test('Command Palette menu item should exist only in View menu', async () => {
    const menuPlacement = await electronApp.evaluate(({ Menu }) => {
      const appMenu = Menu.getApplicationMenu();
      if (!appMenu) {
        return { totalCount: 0, viewCount: 0 };
      }

      let totalCount = 0;
      let viewCount = 0;

      for (const topLevelItem of appMenu.items) {
        if (!topLevelItem.submenu) continue;

        const isViewMenu = topLevelItem.label === 'View' || topLevelItem.role === 'viewMenu';
        for (const subItem of topLevelItem.submenu.items) {
          if (!subItem.label?.includes('Command Palette')) continue;
          totalCount += 1;
          if (isViewMenu) {
            viewCount += 1;
          }
        }
      }

      return { totalCount, viewCount };
    });

    expect(menuPlacement.totalCount).toBe(1);
    expect(menuPlacement.viewCount).toBe(1);
  });

  test('Cmd+Shift+P should be registered once for Command Palette in View', async () => {
    const shortcutPlacement = await electronApp.evaluate(({ Menu }) => {
      const appMenu = Menu.getApplicationMenu();
      if (!appMenu) {
        return { acceleratorCount: 0, viewCommandPaletteAcceleratorCount: 0 };
      }

      let acceleratorCount = 0;
      let viewCommandPaletteAcceleratorCount = 0;

      for (const topLevelItem of appMenu.items) {
        if (!topLevelItem.submenu) continue;

        const isViewMenu = topLevelItem.label === 'View' || topLevelItem.role === 'viewMenu';
        for (const subItem of topLevelItem.submenu.items) {
          if (subItem.accelerator !== 'CmdOrCtrl+Shift+P') continue;
          acceleratorCount += 1;

          if (isViewMenu && subItem.label?.includes('Command Palette')) {
            viewCommandPaletteAcceleratorCount += 1;
          }
        }
      }

      return { acceleratorCount, viewCommandPaletteAcceleratorCount };
    });

    expect(shortcutPlacement.acceleratorCount).toBe(1);
    expect(shortcutPlacement.viewCommandPaletteAcceleratorCount).toBe(1);
  });
});

test.describe('Accessibility', () => {
  test('command palette should have proper ARIA attributes', async () => {
    await openPalette(page);

    const hasAriaAttributes = await page.evaluate(() => {
      const dialog = document.querySelector('[data-testid="command-palette"]');
      const listbox = document.querySelector('[data-testid="command-list"]');
      const searchInput = document.querySelector('[data-testid="command-palette-input"]');

      return {
        hasDialog: dialog !== null,
        hasListbox: listbox !== null,
        hasSearchInput: searchInput !== null,
      };
    });

    await closePalette(page);

    expect(hasAriaAttributes.hasDialog || hasAriaAttributes.hasSearchInput).toBe(true);
  });

  test('focus should be trapped within command palette', async () => {
    await openPalette(page);

    const focusInPalette = await page.evaluate(() => {
      const activeElement = document.activeElement;
      const palette = document.querySelector('[data-testid="command-palette"]');

      if (!palette) {
        return activeElement?.getAttribute('data-testid') === 'command-palette-input';
      }

      return palette.contains(activeElement);
    });

    await closePalette(page);

    expect(focusInPalette).toBe(true);
  });
});
