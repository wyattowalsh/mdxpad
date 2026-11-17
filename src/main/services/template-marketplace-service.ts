/**
 * Template Marketplace Service
 *
 * Main process service for fetching template catalogs, downloading,
 * installing, and validating marketplace templates.
 *
 * @module main/services/template-marketplace-service
 */

import { ipcMain, type BrowserWindow } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  MARKETPLACE_LIST_CHANNEL,
  MarketplaceTemplateSchema,
} from '@shared/contracts/marketplace-schemas';
import { registerAuthorizedIpcHandler } from '@main/ipc/ipc-sender-authorization';

// =============================================================================
// TYPES
// =============================================================================

export interface MarketplaceTemplateData {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly author: string;
  readonly category: string;
  readonly previewUrl: string;
  readonly downloadUrl: string;
  readonly version: string;
  readonly downloads: number;
}

export interface MarketplaceResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default catalog URL. Can be overridden via settings.
 */
const DEFAULT_CATALOG_URL = 'https://mdxpad.dev/api/templates/catalog.json';
const REMOTE_CATALOG_TIMEOUT_MS = 1500;
/**
 * Local fallback catalog path (bundled with the app).
 */
const LOCAL_CATALOG_FILENAME = 'template-catalog.json';

// =============================================================================
// SERVICE
// =============================================================================

/**
 * Fetch the template catalog from remote or local fallback.
 */
export function sanitizeMarketplaceCatalog(value: unknown): MarketplaceTemplateData[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const templates: MarketplaceTemplateData[] = [];
  for (const item of value) {
    const parsed = MarketplaceTemplateSchema.safeParse(item);
    if (parsed.success) {
      templates.push(parsed.data);
    }
  }
  return templates;
}

async function readLocalCatalog(resourcesPath: string): Promise<MarketplaceTemplateData[] | null> {
  try {
    const content = await fs.readFile(path.join(resourcesPath, LOCAL_CATALOG_FILENAME), 'utf-8');
    return sanitizeMarketplaceCatalog(JSON.parse(content) as unknown);
  } catch {
    return null;
  }
}

async function fetchCatalog(
  catalogUrl: string,
  resourcesPath: string
): Promise<MarketplaceResult<readonly MarketplaceTemplateData[]>> {
  const local = await readLocalCatalog(resourcesPath);
  if (local !== null) {
    return { success: true, data: local };
  }

  try {
    const response = await fetch(catalogUrl, {
      signal: AbortSignal.timeout(REMOTE_CATALOG_TIMEOUT_MS),
    });
    if (response.ok) {
      return {
        success: true,
        data: sanitizeMarketplaceCatalog((await response.json()) as unknown),
      };
    }
  } catch {
    // A missing remote catalog leaves the browser empty. Install stays unavailable.
  }

  return { success: true, data: [] };
}

// =============================================================================
// IPC HANDLER REGISTRATION
// =============================================================================

/**
 * Register the marketplace catalog handler.
 * Install stays unregistered until a real catalog publisher exists.
 *
 * @param window - Window allowed to invoke the handler
 * @param resourcesPath - Path to bundled resources
 */
export function registerMarketplaceHandlers(window: BrowserWindow, resourcesPath: string): void {
  registerAuthorizedIpcHandler(ipcMain, window, MARKETPLACE_LIST_CHANNEL, () =>
    fetchCatalog(DEFAULT_CATALOG_URL, resourcesPath)
  );
}
