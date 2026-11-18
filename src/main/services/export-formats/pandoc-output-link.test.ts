import { execFile } from 'node:child_process';
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PandocBridge } from './pandoc-bridge';

vi.mock('./pandoc-detector', () => ({
  detectPandoc: vi.fn().mockResolvedValue({
    available: true,
    path: '/usr/bin/pandoc',
    version: '3.1.0',
  }),
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

describe('Pandoc output links', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('writes the Pandoc result in place of a link', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-pandoc-link-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-pandoc-secret-'));
    dirs.push(root, outside);
    const secret = path.join(outside, 'note.html');
    const output = path.join(root, 'note.html');
    await writeFile(secret, 'secret');
    await symlink(secret, output);

    vi.mocked(execFile).mockImplementation(((
      _command: string,
      args: readonly string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      const outputIndex = args.indexOf('--output');
      const target = args[outputIndex + 1] ?? output;
      void writeFile(target, '<p>Note</p>').then(
        () => {
          callback(null, '', '');
        },
        (error: unknown) => {
          callback(error instanceof Error ? error : new Error('pandoc failed'), '', '');
        }
      );
      return { stdin: { write: () => undefined, end: () => undefined } };
    }) as unknown as typeof execFile);

    const result = await new PandocBridge({ targetFormat: 'html' }).export({
      content: '# Note',
      title: 'Note',
      outputPath: output,
    });

    expect(result.ok).toBe(true);
    expect(await readFile(secret, 'utf8')).toBe('secret');
    expect((await lstat(output)).isSymbolicLink()).toBe(false);
    expect(await readFile(output, 'utf8')).toBe('<p>Note</p>');
  });
});
