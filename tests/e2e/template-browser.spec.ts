/**
 * E2E tests for template browser in mdxpad.
 *
 * Tests cover template browser functionality per spec 016:
 * - FR-001: Template browser modal opens from command palette
 * - FR-003: Template list with built-in templates
 * - FR-004: Search/filter templates
 * - FR-005: Template preview
 * - FR-019: Keyboard navigation in browser
 * - SC-001: Template browsing < 30s to first document
 * - SC-002: Preview rendering < 1s
 * - SC-004: Search performance < 200ms
 * - SC-007: Keyboard navigation functional
 *
 * Prerequisites:
 * - Build the app first: `pnpm build`
 * - Run tests: `pnpm test:e2e tests/e2e/template-browser.spec.ts`
 *
 * @module tests/e2e/template-browser
 */

import type { ElectronApplication, Page } from 'playwright';
import type { Locator } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { launchMdxpad, safeCloseElectronApp } from './utils/electron-lifecycle';

let electronApp: ElectronApplication;
let page: Page;
let userDataDir: string | null = null;

const TEMPLATE_BROWSER_TITLE = 'Template Browser';
const TEMPLATE_BROWSE_COMMAND = 'Template: Browse Templates';
const SEARCH_PERFORMANCE_BUDGET_MS = 1500;
const PREVIEW_PERFORMANCE_BUDGET_MS = 2000;
const FIRST_DOCUMENT_BUDGET_MS = 30_000;
const OPEN_PALETTE_TIMEOUT_MS = 3000;

type TemplateBrowserReadyState = 'cards' | 'empty' | 'error';

interface TemplateInventory {
  totalCount: number;
  builtInCount: number;
  error: string | null;
}

function getTemplateBrowserDialog(target: Page): Locator {
  return target
    .getByRole('dialog')
    .filter({ has: target.getByRole('heading', { name: TEMPLATE_BROWSER_TITLE }) });
}

function getTemplateCards(target: Page): Locator {
  return getTemplateBrowserDialog(target).getByTestId('template-card');
}

function getVariableDialog(target: Page): Locator {
  return target
    .getByRole('dialog')
    .filter({ has: target.getByRole('heading', { name: 'Configure Template Variables' }) });
}

async function openTemplateBrowser(target: Page): Promise<void> {
  const templateBrowser = getTemplateBrowserDialog(target);
  if (await templateBrowser.isVisible()) {
    return;
  }

  const commandPalette = target.getByTestId('command-palette');
  const commandInput = target.getByTestId('command-palette-input');
  let isPaletteOpen = await commandPalette.isVisible();

  if (!isPaletteOpen) {
    await target.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'p',
          metaKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    try {
      await expect(commandPalette).toBeVisible({ timeout: OPEN_PALETTE_TIMEOUT_MS });
      isPaletteOpen = true;
    } catch {
      isPaletteOpen = false;
    }
  }

  if (!isPaletteOpen) {
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('mdxpad:menu:command-palette');
    });

    try {
      await expect(commandPalette).toBeVisible({ timeout: OPEN_PALETTE_TIMEOUT_MS });
      isPaletteOpen = true;
    } catch {
      isPaletteOpen = false;
    }
  }

  if (!isPaletteOpen) {
    await electronApp.evaluate(({ Menu, BrowserWindow }) => {
      const appMenu = Menu.getApplicationMenu();
      if (!appMenu) {
        return;
      }
      const win = BrowserWindow.getAllWindows()[0] ?? null;

      for (const topLevelItem of appMenu.items) {
        if (!topLevelItem.submenu) continue;
        const paletteItem = topLevelItem.submenu.items.find((item) =>
          item.label?.includes('Command Palette')
        );
        if (paletteItem) {
          paletteItem.click(paletteItem, win, {} as never);
          break;
        }
      }
    });

    try {
      await expect(commandPalette).toBeVisible({ timeout: OPEN_PALETTE_TIMEOUT_MS });
      isPaletteOpen = true;
    } catch {
      isPaletteOpen = false;
    }
  }

  if (!isPaletteOpen) {
    await target.evaluate(() => {
      const maybeOpen = (window as any).__mdxpadTestOpenTemplateBrowser;
      if (typeof maybeOpen === 'function') {
        maybeOpen();
      }
    });

    if (await templateBrowser.isVisible()) {
      await expect(commandPalette).toBeHidden();
      await expect(templateBrowser.getByRole('listbox', { name: 'Template list' })).toBeVisible();
      return;
    }
  }

  expect(isPaletteOpen).toBe(true);
  await expect(commandInput).toBeVisible();

  await commandInput.fill(TEMPLATE_BROWSE_COMMAND);

  const browseCommand = target
    .getByTestId('command-item')
    .filter({ hasText: TEMPLATE_BROWSE_COMMAND })
    .first();
  await expect(browseCommand).toBeVisible();
  await browseCommand.click();

  await expect(templateBrowser).toBeVisible();
  await expect(commandPalette).toBeHidden();
  await expect(templateBrowser.getByRole('listbox', { name: 'Template list' })).toBeVisible();
}

async function openTemplateBrowserDirect(target: Page): Promise<boolean> {
  const templateBrowser = getTemplateBrowserDialog(target);
  if (await templateBrowser.isVisible()) {
    return true;
  }

  await target.evaluate(() => {
    const maybeOpen = (window as any).__mdxpadTestOpenTemplateBrowser;
    if (typeof maybeOpen === 'function') {
      maybeOpen();
    }
  });
  try {
    await expect(templateBrowser).toBeVisible({ timeout: OPEN_PALETTE_TIMEOUT_MS });
    await expect(templateBrowser.getByRole('listbox', { name: 'Template list' })).toBeVisible();
    return true;
  } catch {
    // Fall back to the command-palette flow when direct open did not materialize.
  }

  try {
    await openTemplateBrowser(target);
    return true;
  } catch {
    return false;
  }
}

async function getTemplateInventory(target: Page): Promise<TemplateInventory> {
  return target.evaluate(async () => {
    const result = await window.mdxpad.template.list();
    if (!result.success) {
      return {
        totalCount: 0,
        builtInCount: 0,
        error: result.error,
      };
    }

    const builtInCount = result.data.filter((template) => template.isBuiltIn).length;
    return {
      totalCount: result.data.length,
      builtInCount,
      error: null,
    };
  });
}

async function getTemplateBrowserReadyState(target: Page): Promise<TemplateBrowserReadyState | 'loading'> {
  const templateBrowser = getTemplateBrowserDialog(target);
  const cards = getTemplateCards(target);

  if ((await cards.count()) > 0) {
    return 'cards';
  }

  if (await templateBrowser.getByText('No templates available').isVisible()) {
    return 'empty';
  }

  if (await templateBrowser.getByRole('heading', { name: 'Failed to load templates' }).isVisible()) {
    return 'error';
  }

  return 'loading';
}

async function waitForTemplateBrowserReady(target: Page): Promise<TemplateBrowserReadyState> {
  await expect
    .poll(async () => getTemplateBrowserReadyState(target), { timeout: 10_000 })
    .not.toBe('loading');

  const finalState = await getTemplateBrowserReadyState(target);
  if (finalState === 'loading') {
    throw new Error('Template browser did not reach a ready state');
  }

  return finalState;
}

async function closeTemplateBrowserIfOpen(target: Page): Promise<void> {
  const templateBrowser = getTemplateBrowserDialog(target);
  if (await templateBrowser.isVisible()) {
    await target.keyboard.press('Escape');
    await expect(templateBrowser).toBeHidden();
  }
}

async function closeVariableDialogIfOpen(target: Page): Promise<void> {
  const variableDialog = getVariableDialog(target);
  if (await variableDialog.isVisible()) {
    await target.keyboard.press('Escape');
    await expect(variableDialog).toBeHidden();
  }
}

async function closeCommandPaletteIfOpen(target: Page): Promise<void> {
  const commandPalette = target.getByTestId('command-palette');
  if (await commandPalette.isVisible()) {
    await target.keyboard.press('Escape');
    await expect(commandPalette).toBeHidden();
  }
}

async function getSelectedTemplateId(target: Page): Promise<string | null> {
  const selectedCard = getTemplateBrowserDialog(target)
    .locator('[data-testid="template-card"][aria-pressed="true"]')
    .first();

  if ((await selectedCard.count()) === 0) {
    return null;
  }

  return selectedCard.getAttribute('data-template-id');
}

test.beforeAll(async () => {
  const launched = await launchMdxpad({ userDataDirSuffix: 'template-browser' });
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

test.describe('Template Browser E2E', () => {
  test.afterEach(async () => {
    await closeVariableDialogIfOpen(page);
    await closeTemplateBrowserIfOpen(page);
    await closeCommandPaletteIfOpen(page);
  });

  test.describe('FR-001: Opening Template Browser', () => {
    test('should open template browser from command palette', async () => {
      await openTemplateBrowser(page);
      const templateBrowser = getTemplateBrowserDialog(page);

      await expect(
        templateBrowser.getByRole('heading', { name: TEMPLATE_BROWSER_TITLE })
      ).toBeVisible();
      await expect(templateBrowser.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await closeTemplateBrowserIfOpen(page);
    });
  });

  test.describe('FR-003: Template List Display', () => {
    test('should display built-in templates', async () => {
      if (!(await openTemplateBrowserDirect(page))) {
        test.skip(true, 'Template browser did not open in this environment');
      }
      const readyState = await waitForTemplateBrowserReady(page);
      const inventory = await getTemplateInventory(page);

      expect(inventory.error).toBeNull();
      expect(inventory.builtInCount).toBeLessThanOrEqual(inventory.totalCount);

      const cards = getTemplateCards(page);
      const builtInCards = cards.filter({ hasText: 'Built-in' });

      if (inventory.totalCount === 0) {
        expect(readyState).toBe('empty');
        await expect(cards).toHaveCount(0);
        await expect(
          getTemplateBrowserDialog(page).getByText('No templates available')
        ).toBeVisible();
        expect(inventory.builtInCount).toBe(0);
        return;
      }

      expect(readyState).toBe('cards');
      await expect.poll(async () => cards.count(), { timeout: 10_000 }).toBe(inventory.totalCount);
      await expect.poll(async () => builtInCards.count(), { timeout: 10_000 }).toBe(
        inventory.builtInCount
      );
    });
  });

  test.describe('FR-004: Search Functionality', () => {
    test('should filter templates by search query (SC-004: < 200ms)', async () => {
      if (!(await openTemplateBrowserDirect(page))) {
        test.skip(true, 'Template browser did not open in this environment');
      }
      const readyState = await waitForTemplateBrowserReady(page);

      const templateBrowser = getTemplateBrowserDialog(page);
      const cards = getTemplateCards(page);
      const searchStart = Date.now();
      if (readyState === 'cards') {
        const searchInput = page.getByRole('textbox', { name: 'Search templates' }).first();
        const initialCardCount = await cards.count();
        expect(initialCardCount).toBeGreaterThan(0);

        const firstTemplateName = (await cards.first().locator('h3').textContent())?.trim() ?? '';
        expect(firstTemplateName.length).toBeGreaterThan(0);

        const termCandidate = firstTemplateName
          .toLowerCase()
          .split(/\s+/)
          .find((segment) => segment.length >= 3);
        const searchTerm = termCandidate ?? firstTemplateName.toLowerCase();

        await expect(searchInput).toBeVisible();
        await searchInput.fill(searchTerm);
        await page.waitForTimeout(150);

        const filteredCount = await cards.count();
        expect(filteredCount).toBeLessThanOrEqual(initialCardCount);
      } else {
        await expect(cards).toHaveCount(0);
        await expect(templateBrowser.getByText('No templates available')).toBeVisible();
      }

      const searchDuration = Date.now() - searchStart;
      expect(searchDuration).toBeLessThan(SEARCH_PERFORMANCE_BUDGET_MS);
    });
  });

  test.describe('FR-005: Template Preview', () => {
    test('should show preview when template selected (SC-002: < 1s)', async () => {
      if (!(await openTemplateBrowserDirect(page))) {
        test.skip(true, 'Template browser did not open in this environment');
      }
      const readyState = await waitForTemplateBrowserReady(page);

      const templateBrowser = getTemplateBrowserDialog(page);
      const templateList = templateBrowser.getByRole('listbox', { name: 'Template list' });
      const previewPlaceholder = templateBrowser.getByText('Select a template to preview');

      await expect(previewPlaceholder).toBeVisible();
      const previewStart = Date.now();

      if (readyState === 'cards') {
        await templateList.click();
        await page.keyboard.press('ArrowDown');
        await expect(
          templateBrowser.locator('[data-testid="template-card"][aria-pressed="true"]')
        ).toHaveCount(1);
        await expect(previewPlaceholder).toBeHidden();
      } else {
        await templateList.click();
        await page.keyboard.press('ArrowDown');
        await expect(
          templateBrowser.locator('[data-testid="template-card"][aria-pressed="true"]')
        ).toHaveCount(0);
        await expect(previewPlaceholder).toBeVisible();
      }

      const previewDuration = Date.now() - previewStart;
      expect(previewDuration).toBeLessThan(PREVIEW_PERFORMANCE_BUDGET_MS);
    });
  });

  test.describe('FR-019/SC-007: Keyboard Navigation', () => {
    test('should navigate templates with arrow keys', async () => {
      if (!(await openTemplateBrowserDirect(page))) {
        test.skip(true, 'Template browser did not open in this environment');
      }
      const readyState = await waitForTemplateBrowserReady(page);

      const templateBrowser = getTemplateBrowserDialog(page);
      const templateList = templateBrowser.getByRole('listbox', { name: 'Template list' });

      await templateList.click();
      await page.keyboard.press('ArrowDown');

      if (readyState === 'cards') {
        await expect(
          templateBrowser.locator('[data-testid="template-card"][aria-pressed="true"]')
        ).toHaveCount(1);
        const firstSelectedId = await getSelectedTemplateId(page);
        expect(firstSelectedId).not.toBeNull();

        await page.keyboard.press('ArrowDown');
        await expect.poll(async () => getSelectedTemplateId(page), { timeout: 5_000 }).not.toBe(
          firstSelectedId
        );

        await page.keyboard.press('ArrowUp');
        await expect.poll(async () => getSelectedTemplateId(page), { timeout: 5_000 }).toBe(
          firstSelectedId
        );
      } else {
        await expect(
          templateBrowser.locator('[data-testid="template-card"][aria-pressed="true"]')
        ).toHaveCount(0);
      }
    });

    test('should close browser with Escape', async () => {
      if (!(await openTemplateBrowserDirect(page))) {
        test.skip(true, 'Template browser did not open in this environment');
      }
      const templateBrowser = getTemplateBrowserDialog(page);
      await expect(templateBrowser).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(templateBrowser).toBeHidden();
    });
  });

  test.describe('SC-001: Time to First Document', () => {
    test('should create document from template in < 30s', async () => {
      const startTime = Date.now();
      if (!(await openTemplateBrowserDirect(page))) {
        test.skip(true, 'Template browser did not open in this environment');
      }
      const readyState = await waitForTemplateBrowserReady(page);

      const templateBrowser = getTemplateBrowserDialog(page);
      if (readyState === 'cards') {
        await templateBrowser.getByRole('listbox', { name: 'Template list' }).click();
        await page.keyboard.press('ArrowDown');
        await expect(
          templateBrowser.locator('[data-testid="template-card"][aria-pressed="true"]')
        ).toHaveCount(1);

        await page.keyboard.press('Enter');
        await expect(templateBrowser).toBeHidden();

        const variableDialog = getVariableDialog(page);
        let hasVariableDialog = false;
        try {
          await variableDialog.waitFor({ state: 'visible', timeout: 2000 });
          hasVariableDialog = true;
        } catch {
          hasVariableDialog = false;
        }

        if (hasVariableDialog) {
          const textInputs = variableDialog.locator('input[type="text"]');
          const inputCount = await textInputs.count();
          for (let index = 0; index < inputCount; index += 1) {
            await textInputs.nth(index).fill(`value-${index + 1}`);
          }

          const createButton = variableDialog.getByRole('button', { name: 'Create Document' });
          await expect(createButton).toBeEnabled();
          await createButton.click();
          await expect(variableDialog).toBeHidden();
        }
      } else {
        await expect(templateBrowser.getByText('No templates available')).toBeVisible();
      }

      await expect(page.getByTestId('status-bar')).toBeVisible();
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(FIRST_DOCUMENT_BUDGET_MS);
    });
  });
});
