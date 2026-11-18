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
import { parseTemplateMetadataFile } from './template/parser';

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

/** Directories that hold the templates shipped with the app. */
export function marketplaceTemplateDirectories(resourcesPath: string): readonly string[] {
  return Array.from(
    new Set([
      path.join(resourcesPath, 'templates'),
      path.resolve(process.cwd(), 'resources', 'templates'),
    ])
  );
}

export async function catalogFromTemplateDirectory(
  directory: string
): Promise<MarketplaceTemplateData[]> {
  let names: string[];
  try {
    names = await fs.readdir(directory);
  } catch {
    return [];
  }

  const templates: MarketplaceTemplateData[] = [];
  for (const name of names) {
    if (!name.endsWith('.mdxt')) {
      continue;
    }
    try {
      const metadata = await parseTemplateMetadataFile(path.join(directory, name), true);
      templates.push({
        id: metadata.id,
        name: metadata.name,
        description: metadata.description,
        author: metadata.author ?? 'mdxpad',
        category: metadata.category,
        previewUrl: '',
        downloadUrl: '',
        version: '1.0.0',
        downloads: 0,
      });
    } catch {
      // Skip a template the catalog cannot describe.
    }
  }
  return templates.sort((left, right) => left.name.localeCompare(right.name));
}

async function bundledCatalog(
  templateDirectories: readonly string[]
): Promise<MarketplaceTemplateData[]> {
  for (const directory of templateDirectories) {
    const templates = await catalogFromTemplateDirectory(directory);
    if (templates.length > 0) {
      return templates;
    }
  }
  return [];
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
  resourcesPath: string,
  templateDirectories: readonly string[]
): Promise<MarketplaceResult<readonly MarketplaceTemplateData[]>> {
  const local = await readLocalCatalog(resourcesPath);
  if (local !== null) {
    return { success: true, data: local };
  }

  const bundled = await bundledCatalog(templateDirectories);
  if (bundled.length > 0) {
    return { success: true, data: bundled };
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
    fetchCatalog(DEFAULT_CATALOG_URL, resourcesPath, marketplaceTemplateDirectories(resourcesPath))
  );
}
