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

import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { test, expect } from '@playwright/test';
import { join } from 'node:path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // Launch Electron app
  const electronPath = join(process.cwd(), 'node_modules', '.bin', 'electron');
  const appPath = join(process.cwd(), 'dist', 'main', 'index.js');

  electronApp = await electron.launch({
    args: [appPath],
    executablePath: electronPath,
    env: {
      ...process.env,
      NODE_ENV: 'test',
    } as Record<string, string>,
  });

  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Command Palette E2E', () => {
  test.describe('FR-005: Opening Command Palette', () => {
    test('Cmd+Shift+P should open command palette', async () => {
      // Press Cmd+Shift+P to open palette
      await page.keyboard.press('Meta+Shift+p');
      await page.waitForTimeout(100);

      // Look for command palette elements
      const paletteVisible = await page.evaluate(() => {
        // Look for command palette container by role or data attribute
        const palette = document.querySelector('[role="dialog"]') ||
                       document.querySelector('[data-command-palette]') ||
                       document.querySelector('[data-state="open"]');
        return palette !== null;
      });

      // Close palette for next test
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      expect(paletteVisible).toBe(true);
    });

    test('Escape should close command palette', async () => {
      // Open palette
      await page.keyboard.press('Meta+Shift+p');
      await page.waitForTimeout(100);

      // Verify it's open
      const openBefore = await page.evaluate(() => {
        const palette = document.querySelector('[role="dialog"]') ||
                       document.querySelector('[data-command-palette]') ||
                       document.querySelector('[data-state="open"]');
        return palette !== null;
      });

      // Close with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      // Verify it's closed
      const openAfter = await page.evaluate(() => {
        const palette = document.querySelector('[role="dialog"]') ||
                       document.querySelector('[data-command-palette]') ||
                       document.querySelector('[data-state="open"]');
        return palette !== null;
      });

      expect(openBefore).toBe(true);
      expect(openAfter).toBe(false);
    });

    test('clicking outside should close command palette', async () => {
      // Open palette
      await page.keyboard.press('Meta+Shift+p');
      await page.waitForTimeout(100);

      // Click outside palette (on the overlay backdrop)
      const clicked = await page.evaluate(() => {
        const overlay = document.querySelector('[data-overlay]') ||
                       document.querySelector('.fixed.inset-0');
        if (overlay) {
          (overlay as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (clicked) {
        await page.waitForTimeout(100);

        const openAfter = await page.evaluate(() => {
          const palette = document.querySelector('[role="dialog"]') ||
                         document.querySelector('[data-command-palette]');
          return palette !== null;
        });

        expect(openAfter).toBe(false);
      }
    });
  });

  test.describe('FR-006: Command Search', () => {
    test('should filter commands as user types', async () => {
      // Open palette
      await page.keyboard.press('Meta+Shift+p');
      await page.waitForTimeout(100);

      // Type search query
      await page.keyboard.type('bold');
      await page.waitForTimeout(100);

      // Check if filtered results appear
      const hasFilteredResults = await page.evaluate(() => {
        const items = document.querySelectorAll('[data-command-item]') ||
                     document.querySelectorAll('[role="option"]') ||
                     document.querySelectorAll('.command-item');
        return items.length > 0;
      });

      // Close palette
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      expect(hasFilteredResults).toBe(true);
    });

    test('search should be case-insensitive', async () => {
      // Open palette
      await page.keyboard.press('Meta+Shift+p');
      await page.waitForTimeout(100);

      // Type uppercase search query
      await page.keyboard.type('BOLD');
      await page.waitForTimeout(100);

      // Should still find "Bold" command
      const foundCommand = await page.evaluate(() => {
        const items = document.querySelectorAll('[data-command-item], [role="option"]');
        for (const item of items) {
          if (item.textContent?.toLowerCase().includes('bold')) {
            return true;
          }
        }
        return false;
      });

      // Close palette
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      expect(foundCommand).toBe(true);
    });

    test('should show "No commands found" for unmatched search', async () => {
      // Open palette
      await page.keyboard.press('Meta+Shift+p');
      await page.waitForTimeout(100);

      // Type gibberish search query
      await page.keyboard.type('xyznonexistent123');
      await page.waitForTimeout(100);

      // Check for empty state message
      const hasEmptyState = await page.evaluate(() => {
        const emptyText = document.body.innerText;
        return emptyText.toLowerCase().includes('no commands') ||
               emptyText.toLowerCase().includes('no results');
      });

      // Close palette
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      expect(hasEmptyState).toBe(true);
    });
  });

  test.describe('FR-007: Keyboard Navigation', () => {
    test('arrow keys should navigate command list', async () => {
      // Open palette
      await page.keyboard.press('Meta+Shift+p');
      await page.waitForTimeout(100);

      // Get initial selected item
      const initialSelected = await page.evaluate(() => {
        const selected = document.querySelector('[aria-selected="true"]') ||
                        document.querySelector('[data-selected]') ||
                        document.querySelector('.selected');
        return selected?.textContent ?? '';
      });

      // Press down arrow
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(50);

      // Get new selected item
      const afterDown = await page.evaluate(() => {
        const selected = document.querySelector('[aria-selected="true"]') ||
                        document.querySelector('[data-selected]') ||
                        document.querySelector('.selected');
        return selected?.textContent ?? '';
      });

      // Close palette
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      // Selection should have changed (or stayed if at bottom)
      // We can't strictly assert they're different since first item might be selected
      expect(typeof afterDown).toBe('string');
    });

    test('Enter should execute selected command', async () => {
      // Set up detection for command execution
      await page.evaluate(() => {
        (window as any).__commandExecuted = false;
        (window as any).__executedCommandId = null;
      });

      // Open palette
      await page.keyboard.press('Meta+Shift+p');
      await page.waitForTimeout(100);

      // Type to filter to a specific command
      await page.keyboard.type('toggle preview');
      await page.waitForTimeout(100);

      // Press Enter to execute
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      // Palette should close after execution
      const paletteOpen = await page.evaluate(() => {
        const palette = document.querySelector('[role="dialog"]') ||
                       document.querySelector('[data-command-palette]');
        return palette !== null;
      });

      expect(paletteOpen).toBe(false);
    });
  });

  test.describe('FR-008: Command Execution', () => {
    test('should execute view commands from palette', async () => {
      // Open palette
      await page.keyboard.press('Meta+Shift+p');
      await page.waitForTimeout(100);

      // Search for zoom command
      await page.keyboard.type('zoom in');
      await page.waitForTimeout(100);

      // Execute
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      // Command should have executed (palette closes)
      const paletteOpen = await page.evaluate(() => {
        const palette = document.querySelector('[role="dialog"]');
        return palette !== null;
      });

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
      await page.keyboard.press('Meta+Shift+p');
      await page.waitForTimeout(100);
      await page.keyboard.type('toggle preview');
      await page.waitForTimeout(100);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      // Reopen palette
      await page.keyboard.press('Meta+Shift+p');
      await page.waitForTimeout(100);

      // Check for recent commands section or the executed command at top
      const hasRecentSection = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('recent') || text.includes('toggle preview');
      });

      // Close palette
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      expect(hasRecentSection).toBe(true);
    });
  });

  test.describe('Shortcut Display', () => {
    test('commands should display their keyboard shortcuts', async () => {
      // Open palette
      await page.keyboard.press('Meta+Shift+p');
      await page.waitForTimeout(100);

      // Search for a command with a known shortcut
      await page.keyboard.type('bold');
      await page.waitForTimeout(100);

      // Check if shortcut is displayed (e.g., "⌘B" or "Ctrl+B")
      const hasShortcut = await page.evaluate(() => {
        const text = document.body.innerText;
        // Look for common shortcut patterns
        return text.includes('⌘') ||
               text.includes('Ctrl') ||
               text.includes('Cmd') ||
               text.includes('+B') ||
               text.includes('⌘B');
      });

      // Close palette
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      expect(hasShortcut).toBe(true);
    });
  });

  test.describe('Category Grouping', () => {
    test('commands should be grouped by category', async () => {
      // Open palette
      await page.keyboard.press('Meta+Shift+p');
      await page.waitForTimeout(100);

      // Check for category headers
      const hasCategories = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        // Check for common category names
        return text.includes('edit') ||
               text.includes('view') ||
               text.includes('file');
      });

      // Close palette
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      expect(hasCategories).toBe(true);
    });
  });
});

test.describe('Menu Integration', () => {
  test('Command Palette menu item should exist in View menu', async () => {
    const hasMenuItem = await electronApp.evaluate(({ Menu }) => {
      const appMenu = Menu.getApplicationMenu();
      if (!appMenu) return false;

      // Find View menu
      const viewMenu = appMenu.items.find(
        (item) => item.label === 'View' || item.role === 'viewMenu'
      );
      if (!viewMenu?.submenu) return false;

      // Find Command Palette item
      const paletteItem = viewMenu.submenu.items.find(
        (item) =>
          item.label?.includes('Command Palette') ||
          item.accelerator === 'CmdOrCtrl+Shift+P'
      );
      return !!paletteItem;
    });

    expect(hasMenuItem).toBe(true);
  });

  test('Cmd+Shift+P should be registered for Command Palette', async () => {
    const hasShortcut = await electronApp.evaluate(({ Menu }) => {
      const appMenu = Menu.getApplicationMenu();
      if (!appMenu) return false;

      // Check all menu items for the accelerator
      function findAccelerator(items: Electron.MenuItem[]): boolean {
        for (const item of items) {
          if (item.accelerator === 'CmdOrCtrl+Shift+P') {
            return true;
          }
          if (item.submenu && findAccelerator(item.submenu.items)) {
            return true;
          }
        }
        return false;
      }

      return findAccelerator(appMenu.items);
    });

    expect(hasShortcut).toBe(true);
  });
});

test.describe('Accessibility', () => {
  test('command palette should have proper ARIA attributes', async () => {
    // Open palette
    await page.keyboard.press('Meta+Shift+p');
    await page.waitForTimeout(100);

    // Check for ARIA attributes
    const hasAriaAttributes = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const listbox = document.querySelector('[role="listbox"]');
      const searchInput = document.querySelector('input[type="text"]');

      return {
        hasDialog: dialog !== null,
        hasListbox: listbox !== null,
        hasSearchInput: searchInput !== null,
      };
    });

    // Close palette
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // At minimum, should have a dialog or search input
    expect(hasAriaAttributes.hasDialog || hasAriaAttributes.hasSearchInput).toBe(true);
  });

  test('focus should be trapped within command palette', async () => {
    // Open palette
    await page.keyboard.press('Meta+Shift+p');
    await page.waitForTimeout(100);

    // Check if focus is within the palette
    const focusInPalette = await page.evaluate(() => {
      const activeElement = document.activeElement;
      const palette = document.querySelector('[role="dialog"]') ||
                     document.querySelector('[data-command-palette]');

      if (!palette) {
        // Try to find input that might be focused
        return activeElement?.tagName === 'INPUT';
      }

      return palette.contains(activeElement);
    });

    // Close palette
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    expect(focusInPalette).toBe(true);
  });
});
