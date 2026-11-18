import { mkdtemp, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PandocRawExporter } from '../pandoc-bridge';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('../pandoc-detector', () => ({
  detectPandoc: vi.fn(),
}));

describe('Pandoc image paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends an absolute picture path to Pandoc', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-pandoc-image-'));
    const source = path.join(root, 'note.md');
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    await writeFile(path.join(root, 'pixel.png'), png);

    const { detectPandoc } = await import('../pandoc-detector');
    (detectPandoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      available: true,
      path: '/usr/local/bin/pandoc',
    });
    const { execFile } = await import('node:child_process');
    const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
    const written: string[] = [];
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(null, '', '');
        return {
          stdin: {
            write: (value: string) => {
              written.push(value);
            },
            end: vi.fn(),
          },
        };
      }
    );

    const result = await new PandocRawExporter().export({
      content: '![Pixel](pixel.png)',
      outputPath: path.join(root, 'out.html'),
      sourcePath: source,
    });

    expect(result.ok).toBe(true);
    const absolute = path.join(root, 'pixel.png').split(path.sep).join('/');
    expect(written.join('')).toContain(`![Pixel](${absolute})`);
  });
});
