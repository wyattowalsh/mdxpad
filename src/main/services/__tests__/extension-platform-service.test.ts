import { mkdtemp, rm } from 'node:fs/promises';
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
});
