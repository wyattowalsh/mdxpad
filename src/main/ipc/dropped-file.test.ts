import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasReadCapability, hasWriteCapability, resetFileCapabilities } from './document-capability';
import { openDroppedDocument } from './dropped-file';

describe('openDroppedDocument', () => {
  let directory: string;

  beforeEach(async () => {
    resetFileCapabilities();
    directory = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-drop-'));
  });

  afterEach(async () => {
    resetFileCapabilities();
    await rm(directory, { recursive: true, force: true });
  });

  it('grants the dropped document and returns its text', async () => {
    const filePath = path.join(directory, 'note.mdx');
    await writeFile(filePath, '# Dropped');

    const result = await openDroppedDocument(filePath);

    expect(result).toEqual({ ok: true, path: filePath, content: '# Dropped' });
    expect(hasReadCapability(filePath)).toBe(true);
    expect(hasWriteCapability(filePath)).toBe(true);
  });

  it('does not grant a symlink', async () => {
    const target = path.join(directory, 'secret.md');
    const link = path.join(directory, 'note.md');
    await writeFile(target, 'secret');
    await symlink(target, link);

    const result = await openDroppedDocument(link);

    expect(result).toEqual({ ok: false, message: 'That file could not be opened' });
    expect(hasReadCapability(target)).toBe(false);
    expect(hasReadCapability(link)).toBe(false);
  });

  it('does not grant a file that is not a document', async () => {
    const filePath = path.join(directory, 'note.txt');
    await writeFile(filePath, 'plain');

    const result = await openDroppedDocument(filePath);

    expect(result).toEqual({ ok: false, message: 'Drop a Markdown or MDX file' });
    expect(hasReadCapability(filePath)).toBe(false);
  });
});
