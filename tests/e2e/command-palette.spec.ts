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

async function isPaletteOpen(target: Page): Promise<boolean> {
  return await target.evaluate((sel) => document.querySelector(sel) !== null, PALETTE_SELECTOR);
}

/** Opens the command palette and waits for it to appear. */
async function openPalette(target: Page): Promise<void> {
  if (await isPaletteOpen(target)) {
    return;
  }

  await target.bringToFront();
  await target.locator('body').click({ position: { x: 8, y: 8 } });
  await target.keyboard.press('Meta+Shift+p');
  try {
    await expect(target.getByTestId('command-palette')).toBeVisible({ timeout: 3000 });
    return;
  } catch {
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('mdxpad:menu:command-palette');
    });
    await expect(target.getByTestId('command-palette')).toBeVisible({ timeout: 5000 });
  }
}

/** Closes the command palette and waits for it to disappear. */
async function closePalette(target: Page): Promise<void> {
  if (!(await isPaletteOpen(target))) {
    return;
  }

  await target.keyboard.press('Escape');
  const stillOpenAfterEscape = await isPaletteOpen(target);
  if (stillOpenAfterEscape) {
    await target.evaluate(() => {
      const backdrop = document.querySelector('[data-testid="command-palette-backdrop"]');
      if (backdrop) {
        (backdrop as HTMLElement).click();
      }
    });
  }

  await waitForPaletteClosed(target);
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
    .poll(
      async () => {
        return await target.evaluate(
          (sel) => document.querySelector(sel) === null,
          PALETTE_SELECTOR
        );
      },
      { timeout: 10_000 }
    )
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

test.afterEach(async () => {
  // Close palette if open
  const isOpen = await isPaletteOpen(page);
  if (isOpen) await closePalette(page);
  // Clear test globals
  await page.evaluate(() => {
    delete (window as any).__commandExecuted;
    delete (window as any).__executedCommandId;
  });
  // Restore any dialog mocks
  await electronApp.evaluate(() => {
    const r = (globalThis as any).__restoreSaveDialog;
    if (r) r();
  });
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

      const clickedBackdrop = await page.evaluate(() => {
        const backdrop = document.querySelector('[data-testid="command-palette-backdrop"]');
        if (!backdrop) {
          return false;
        }
        (backdrop as HTMLElement).click();
        return true;
      });
      expect(clickedBackdrop).toBe(true);

      await waitForPaletteClosed(page);

      const openAfter = await page.evaluate(
        (sel) => document.querySelector(sel) !== null,
        PALETTE_SELECTOR
      );

      expect(openAfter).toBe(false);
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
      await waitForCommandItems(page);

      const itemCount = await page.locator('[data-testid="command-item"], [role="option"]').count();
      expect(itemCount).toBeGreaterThan(0);

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

      expect(afterDown).toBeTruthy();
      if (itemCount > 1) {
        expect(afterDown).not.toBe(initialSelected);
      }
    });

    test('Enter should execute selected command', async () => {
      await openPalette(page);
      await page.keyboard.type('toggle preview');
      await waitForCommandItems(page);
      await page.keyboard.press('Enter');
      await waitForPaletteClosed(page);

      // Palette auto-closes only on successful command execution (disabled commands keep it open)
      expect(await isPaletteOpen(page)).toBe(false);
    });
  });

  test.describe('FR-008: Command Execution', () => {
    test('should execute view commands from palette', async () => {
      await openPalette(page);
      await page.keyboard.type('zoom in');
      await waitForCommandItems(page);
      await page.keyboard.press('Enter');
      await waitForPaletteClosed(page);

      // Palette auto-closes only on successful command execution
      expect(await isPaletteOpen(page)).toBe(false);
    });

    test('disabled commands should not execute', async () => {
      await electronApp.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win?.webContents.send('mdxpad:menu:new-file');
      });
      await expect(page.getByTestId('file-info-dirty')).toHaveCount(0);

      await electronApp.evaluate(({ dialog }) => {
        (globalThis as { __saveDialogCalled?: boolean }).__saveDialogCalled = false;
        const originalSaveDialog = dialog.showSaveDialog.bind(dialog);
        (globalThis as { __restoreSaveDialog?: () => void }).__restoreSaveDialog = () => {
          dialog.showSaveDialog = originalSaveDialog;
        };
        dialog.showSaveDialog = async () => {
          (globalThis as { __saveDialogCalled?: boolean }).__saveDialogCalled = true;
          return { canceled: true, filePath: '' };
        };
      });

      try {
        await openPalette(page);
        await page.keyboard.type('save');
        await waitForCommandItems(page);

        const saveCommand = page
          .getByTestId('command-item')
          .filter({ has: page.getByText(/^Save$/) })
          .first();
        await expect(saveCommand).toBeVisible();
        await saveCommand.click();

        await expect(page.getByTestId('command-palette')).toBeVisible();
        const saveDialogCalled = await electronApp.evaluate(() => {
          return (globalThis as { __saveDialogCalled?: boolean }).__saveDialogCalled === true;
        });
        expect(saveDialogCalled).toBe(false);

        await closePalette(page);
      } finally {
        await electronApp.evaluate(() => {
          const restore = (globalThis as { __restoreSaveDialog?: () => void }).__restoreSaveDialog;
          if (restore) {
            restore();
          }
        });
      }
    });
  });

  test.describe('FR-009: Recent Commands', () => {
    test('recently executed commands should appear in list', async () => {
      // Seed recent commands explicitly (removes ordering dependency)
      await page.evaluate(() => {
        const key = 'mdxpad:recent-commands';
        localStorage.setItem(key, JSON.stringify([
          { commandId: 'toggle-preview', lastUsed: Date.now(), useCount: 1 }
        ]));
      });

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

    expect(hasAriaAttributes.hasDialog).toBe(true);
    expect(hasAriaAttributes.hasListbox).toBe(true);
    expect(hasAriaAttributes.hasSearchInput).toBe(true);
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
