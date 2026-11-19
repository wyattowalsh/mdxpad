import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  net: { fetch: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
}));

import { previewFrameAssetPath } from './preview-frame-protocol';

describe('previewFrameAssetPath', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function tempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-preview-'));
    dirs.push(dir);
    return dir;
  }

  it('refuses a preview asset that is a link outside the renderer tree', async () => {
    const root = await tempDir();
    const outside = await tempDir();
    const secret = path.join(outside, 'secret.txt');
    await mkdir(path.join(root, 'preview-frame'));
    await writeFile(secret, 'hidden');
    await symlink(secret, path.join(root, 'preview-frame', 'leak'));

    expect(previewFrameAssetPath('mdxpad-preview://local/preview-frame/leak', root)).toBeNull();
  });

  it('allows a real file inside the renderer tree', async () => {
    const root = await tempDir();
    const asset = path.join(root, 'preview-frame', 'app.js');
    await mkdir(path.dirname(asset));
    await writeFile(asset, 'ok');

    expect(previewFrameAssetPath('mdxpad-preview://local/preview-frame/app.js', root)).toBe(asset);
  });
});
