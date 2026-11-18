import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseTemplateFile } from './parser';

const TEMPLATE = `---
name: Note
description: A note
category: notes
---
hello
`;

describe('template files that are links', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
    );
  });

  async function tempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-template-'));
    directories.push(dir);
    return dir;
  }

  it('loads a regular template file', async () => {
    const dir = await tempDir();
    const filePath = path.join(dir, 'note.mdxt');
    await writeFile(filePath, TEMPLATE);

    const template = await parseTemplateFile(filePath, false);

    expect(template.content).toBe('hello');
    expect(template.name).toBe('Note');
  });

  it('does not load a template file that is a link', async () => {
    const dir = await tempDir();
    const secret = path.join(dir, 'secret.mdxt');
    const link = path.join(dir, 'link.mdxt');
    await writeFile(secret, TEMPLATE.replace('hello', 'secret body'));
    await symlink(secret, link);

    await expect(parseTemplateFile(link, false)).rejects.toThrow('Template file is a link');
  });
});
