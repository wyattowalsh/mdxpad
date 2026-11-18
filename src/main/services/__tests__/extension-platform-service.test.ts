import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ExtensionPlatformService } from '../extension-platform-service';

describe('ExtensionPlatformService', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-ext-platform-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('installs extension manifests and assigns default capability permissions', async () => {
    const service = new ExtensionPlatformService(tempDir);
    const result = await service.installExtension({
      manifest: {
        id: 'publisher.example',
        name: 'Publisher Extension',
        version: '0.1.0',
        entrypoint: 'dist/index.js',
        capabilities: {
          'commands.register': true,
          'workspace.write': true,
          'publish.provider': ['filesystem-export'],
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.extension?.state).toBe('installed');
    expect(result.extension?.permissions['commands.register']).toBe('granted');
    expect(result.extension?.permissions['workspace.write']).toBe('prompt');
    expect(result.extension?.permissions['publish.provider']).toBe('prompt');
  });

  it('rejects extension install when checksum verification fails', async () => {
    const service = new ExtensionPlatformService(tempDir);
    const result = await service.installExtension({
      manifest: {
        id: 'checksum.test',
        name: 'Checksum Test',
        version: '0.1.0',
        entrypoint: 'index.js',
        capabilities: {},
      },
      checksum: 'bad-checksum',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('checksum');
  });

  it('does not copy an extension into a second empty registry', async () => {
    const firstDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-ext-a-'));
    const secondDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-ext-b-'));
    try {
      const first = new ExtensionPlatformService(firstDir);
      await first.installExtension({
        manifest: {
          id: 'first.only',
          name: 'First',
          version: '0.1.0',
          entrypoint: 'index.js',
          capabilities: {},
        },
      });

      const second = new ExtensionPlatformService(secondDir);
      await expect(second.listExtensions()).resolves.toEqual([]);
    } finally {
      await rm(firstDir, { recursive: true, force: true });
      await rm(secondDir, { recursive: true, force: true });
    }
  });

  it('does not load an extension registry that is a link', async () => {
    const outside = path.join(tempDir, 'outside.json');
    const registryPath = path.join(tempDir, 'registry.json');
    await writeFile(
      outside,
      JSON.stringify({
        extensions: [
          {
            manifest: {
              id: 'secret.ext',
              name: 'Secret',
              version: '0.1.0',
              entrypoint: 'index.js',
              capabilities: {},
            },
            checksum: 'abc',
            state: 'installed',
            installedAt: 1,
            permissions: {},
          },
        ],
      }),
      'utf-8'
    );
    await symlink(outside, registryPath);
    const service = new ExtensionPlatformService(tempDir);

    await expect(service.listExtensions()).resolves.toEqual([]);
    const installed = await service.installExtension({
      manifest: {
        id: 'local.ext',
        name: 'Local',
        version: '0.1.0',
        entrypoint: 'index.js',
        capabilities: {},
      },
    });

    expect(installed.ok).toBe(true);
    expect(await readFile(outside, 'utf-8')).toContain('secret.ext');
    expect((await lstat(registryPath)).isSymbolicLink()).toBe(false);
    const listed = await service.listExtensions();
    expect(listed.map((extension) => extension.manifest.id)).toEqual(['local.ext']);
  });
});
