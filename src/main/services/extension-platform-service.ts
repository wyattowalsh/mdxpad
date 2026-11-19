import { createHash } from 'node:crypto';
import { constants as fsConstants, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

import { atomicWrite } from '@shared/lib/atomic-write';
import { ensureRealDirectory } from './ensure-real-directory';
import type {
  ExtensionInstallRequest,
  ExtensionInstallResponse,
  ExtensionPermissionState,
  ExtensionRecord,
  ExtensionRuntimeState,
  ExtensionSetPermissionRequest,
  ExtensionSetPermissionResponse,
} from '@shared/contracts/platform-schemas';

interface ExtensionRegistry {
  extensions: ExtensionRecord[];
}

const SAFE_CAPABILITIES = new Set(['commands.register', 'ui.panel']);
const HIGH_RISK_CAPABILITIES = new Set([
  'workspace.write',
  'publish.provider',
  'provenance.emit',
  'network.request',
]);

function freshRegistry(): ExtensionRegistry {
  return { extensions: [] };
}

function getDefaultBaseDir(): string {
  return path.join(app.getPath('userData'), 'extensions-platform');
}

async function ensureDirectory(dir: string): Promise<void> {
  await ensureRealDirectory(dir);
}

async function readRegistryFile(filePath: string): Promise<ExtensionRegistry> {
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const info = await handle.stat();
    if (!info.isFile()) {
      return freshRegistry();
    }
    const content = await handle.readFile({ encoding: 'utf8' });
    const parsed = JSON.parse(content) as Partial<ExtensionRegistry>;
    return { extensions: Array.isArray(parsed.extensions) ? parsed.extensions : [] };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ELOOP' || code === 'EINVAL' || code === 'EPERM') {
      return freshRegistry();
    }
    throw error;
  } finally {
    await handle?.close();
  }
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== 'object') {
    return JSON.stringify(input);
  }
  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries
    .map(([key, value]) => `${JSON.stringify(key)}:${stableStringify(value)}`)
    .join(',')}}`;
}

function computeManifestChecksum(manifest: unknown): string {
  return createHash('sha256').update(stableStringify(manifest), 'utf-8').digest('hex');
}

function getDefaultPermission(
  capability: string,
  value: boolean | string[]
): ExtensionPermissionState {
  if (value === false || (Array.isArray(value) && value.length === 0)) {
    return 'denied';
  }
  if (HIGH_RISK_CAPABILITIES.has(capability)) {
    return 'prompt';
  }
  if (SAFE_CAPABILITIES.has(capability)) {
    return 'granted';
  }
  return 'prompt';
}

export class ExtensionPlatformService {
  private readonly baseDir: string;

  public constructor(baseDir: string = getDefaultBaseDir()) {
    this.baseDir = baseDir;
  }

  private getRegistryPath(): string {
    return path.join(this.baseDir, 'registry.json');
  }

  private async readRegistry(): Promise<ExtensionRegistry> {
    await ensureDirectory(this.baseDir);
    return readRegistryFile(this.getRegistryPath());
  }

  private async writeRegistry(registry: ExtensionRegistry): Promise<void> {
    await ensureDirectory(this.baseDir);
    await atomicWrite(this.getRegistryPath(), JSON.stringify(registry, null, 2));
  }

  public async listExtensions(): Promise<ExtensionRecord[]> {
    const registry = await this.readRegistry();
    return registry.extensions;
  }

  public async installExtension(
    request: ExtensionInstallRequest
  ): Promise<ExtensionInstallResponse> {
    const checksum = computeManifestChecksum(request.manifest);
    if (request.checksum !== undefined && request.checksum !== checksum) {
      return { ok: false, error: 'Manifest checksum verification failed' };
    }

    const registry = await this.readRegistry();
    const permissions: Record<string, ExtensionPermissionState> = {};
    for (const [capability, value] of Object.entries(request.manifest.capabilities)) {
      permissions[capability] = getDefaultPermission(capability, value);
    }

    const extension: ExtensionRecord = {
      manifest: request.manifest,
      checksum,
      state: 'installed',
      installedAt: Date.now(),
      permissions,
    };

    const existingIndex = registry.extensions.findIndex(
      (candidate) => candidate.manifest.id === request.manifest.id
    );
    if (existingIndex >= 0) {
      registry.extensions[existingIndex] = extension;
    } else {
      registry.extensions.push(extension);
    }

    await this.writeRegistry(registry);
    return { ok: true, extension };
  }

  public async setPermission(
    request: ExtensionSetPermissionRequest
  ): Promise<ExtensionSetPermissionResponse> {
    const registry = await this.readRegistry();
    const extension = registry.extensions.find(
      (candidate) => candidate.manifest.id === request.extensionId
    );
    if (!extension) {
      return { ok: false, error: `Extension ${request.extensionId} was not found` };
    }

    extension.permissions[request.capability] = request.state;
    await this.writeRegistry(registry);
    return { ok: true, extension };
  }

  public async setRuntimeState(
    extensionId: string,
    state: ExtensionRuntimeState
  ): Promise<ExtensionSetPermissionResponse> {
    const registry = await this.readRegistry();
    const extension = registry.extensions.find(
      (candidate) => candidate.manifest.id === extensionId
    );
    if (!extension) {
      return { ok: false, error: `Extension ${extensionId} was not found` };
    }

    extension.state = state;
    await this.writeRegistry(registry);
    return { ok: true, extension };
  }
}
