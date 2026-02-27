/**
 * Template Marketplace Service
 *
 * Main process service for fetching template catalogs, downloading,
 * installing, and validating marketplace templates.
 *
 * @module main/services/template-marketplace-service
 */

import { ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

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

/**
 * Local fallback catalog path (bundled with the app).
 */
const LOCAL_CATALOG_FILENAME = 'template-catalog.json';

/**
 * Installation directory for marketplace templates.
 */
const TEMPLATES_DIR_NAME = 'marketplace-templates';

// =============================================================================
// SERVICE
// =============================================================================

/**
 * Get the templates installation directory.
 */
function getTemplatesDir(userDataPath: string): string {
  return path.join(userDataPath, TEMPLATES_DIR_NAME);
}

/**
 * Ensure the templates directory exists.
 */
async function ensureTemplatesDir(userDataPath: string): Promise<string> {
  const dir = getTemplatesDir(userDataPath);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Fetch the template catalog from remote or local fallback.
 */
async function fetchCatalog(
  catalogUrl: string,
  resourcesPath: string
): Promise<MarketplaceResult<readonly MarketplaceTemplateData[]>> {
  try {
    // Try remote first
    const response = await fetch(catalogUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data = (await response.json()) as MarketplaceTemplateData[];
      return { success: true, data };
    }
  } catch {
    // Fall through to local catalog
  }

  // Try local catalog
  try {
    const localPath = path.join(resourcesPath, LOCAL_CATALOG_FILENAME);
    const content = await fs.readFile(localPath, 'utf-8');
    const data = JSON.parse(content) as MarketplaceTemplateData[];
    return { success: true, data };
  } catch {
    // Return empty catalog if both fail
    return { success: true, data: [] };
  }
}

/**
 * Write template files (content + metadata) to disk.
 */
async function writeTemplateFiles(
  template: MarketplaceTemplateData,
  templateDir: string,
  content: string
): Promise<void> {
  await fs.mkdir(templateDir, { recursive: true });
  await fs.writeFile(path.join(templateDir, 'template.mdx'), content, 'utf-8');
  const metadata = {
    id: template.id,
    name: template.name,
    description: template.description,
    author: template.author,
    category: template.category,
    version: template.version,
    installedAt: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(templateDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );
}

/**
 * Download and install a template by its download URL.
 */
async function downloadAndInstallTemplate(
  template: MarketplaceTemplateData,
  templatesDir: string
): Promise<MarketplaceResult<void>> {
  try {
    const response = await fetch(template.downloadUrl, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to download template: ${response.statusText}`,
      };
    }

    const content = await response.text();
    if (!content.trim()) {
      return { success: false, error: 'Template content is empty' };
    }

    const templateDir = path.join(templatesDir, template.id);
    await writeTemplateFiles(template, templateDir, content);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to install template',
    };
  }
}

// =============================================================================
// IPC HANDLER REGISTRATION
// =============================================================================

/**
 * Register IPC handlers for the template marketplace service.
 *
 * @param userDataPath - Electron app.getPath('userData')
 * @param resourcesPath - Path to bundled resources
 * @param catalogUrl - Optional custom catalog URL
 */
export function registerMarketplaceHandlers(
  userDataPath: string,
  resourcesPath: string,
  catalogUrl: string = DEFAULT_CATALOG_URL
): void {
  ipcMain.handle('marketplace:list', async () => {
    return fetchCatalog(catalogUrl, resourcesPath);
  });

  ipcMain.handle('marketplace:install', async (_event, id: string) => {
    // First fetch the catalog to get the template data
    const catalogResult = await fetchCatalog(catalogUrl, resourcesPath);
    if (!catalogResult.success || !catalogResult.data) {
      return { success: false, error: 'Failed to load template catalog' };
    }

    const template = catalogResult.data.find((t) => t.id === id);
    if (!template) {
      return { success: false, error: `Template not found: ${id}` };
    }

    const templatesDir = await ensureTemplatesDir(userDataPath);
    return downloadAndInstallTemplate(template, templatesDir);
  });
}
