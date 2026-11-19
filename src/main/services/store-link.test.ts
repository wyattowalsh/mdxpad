import { lstatSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const userData = vi.hoisted(() => ({ current: '' }));

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => (key === 'userData' ? userData.current : ''),
  },
}));

import { prepareElectronStore, replaceSymlinkFile } from './store-link';

describe('store links', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('replaces a linked file and leaves the target untouched', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'mdxpad-store-'));
    const outside = mkdtempSync(path.join(tmpdir(), 'mdxpad-store-secret-'));
    directories.push(root, outside);
    const secret = path.join(outside, 'secret.json');
    const link = path.join(root, 'recent-files.json');
    writeFileSync(secret, '{"secret":true}');
    symlinkSync(secret, link);

    replaceSymlinkFile(link);

    expect(lstatSync(secret).isFile()).toBe(true);
    expect(() => lstatSync(link)).toThrow();
  });

  it('replaces the electron-store file for a name', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'mdxpad-store-app-'));
    const outside = mkdtempSync(path.join(tmpdir(), 'mdxpad-store-outside-'));
    directories.push(root, outside);
    userData.current = root;
    const secret = path.join(outside, 'secret.json');
    writeFileSync(secret, '{"recentFiles":[{"path":"/secret"}]}');
    symlinkSync(secret, path.join(root, 'recent-files.json'));

    prepareElectronStore('recent-files');

    expect(() => lstatSync(path.join(root, 'recent-files.json'))).toThrow();
    expect(lstatSync(secret).isFile()).toBe(true);
  });
});
