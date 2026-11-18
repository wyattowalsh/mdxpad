import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { grantReadCapability, resetFileCapabilities } from '@main/ipc/document-capability';
import type { ExportCliInvokeRequest } from '@shared/contracts/export-schemas';

import { invokeExportCli } from '../cli-service';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

vi.mock('../export-formats/pandoc-detector', () => ({
  detectPandoc: vi.fn(async () => ({
    available: true,
    path: '/usr/bin/pandoc',
    version: '3.1.0',
  })),
  clearPandocCache: vi.fn(),
}));

describe('pandoc preset export', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    resetFileCapabilities();
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('passes the preset writer and drops an output override', async () => {
    vi.mocked(execFile).mockImplementation(((
      _command: string,
      _args: readonly string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      callback(null, '', '');
      return { stdin: { write: () => undefined, end: () => undefined } };
    }) as unknown as typeof execFile);

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-pandoc-preset-'));
    dirs.push(tempDir);
    const sourcePath = path.join(tempDir, 'source.md');
    const targetPath = path.join(tempDir, 'output.txt');
    await writeFile(sourcePath, '# Hi');
    grantReadCapability(sourcePath);

    const request: ExportCliInvokeRequest = {
      job: {
        id: '550e8400-e29b-41d4-a716-446655440010',
        preset: {
          id: '550e8400-e29b-41d4-a716-446655440011',
          name: 'Pandoc',
          format: 'pandoc',
          options: {
            to: 'plain',
            from: 'markdown',
            timeoutMs: 1500,
            extraArgs: ['--toc', '--output', '/tmp/secret'],
          },
        },
        format: 'pandoc',
        sourcePath,
        targetPath,
        generationMode: 'native',
        status: 'queued',
        warnings: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      command: 'mdxpad-export',
      args: [],
      cwd: tempDir,
      timeoutMs: 5_000,
    };

    const response = await invokeExportCli(request);

    expect(response.ok).toBe(true);
    const args = vi.mocked(execFile).mock.calls[0]?.[1] as string[];
    expect(args[args.indexOf('--to') + 1]).toBe('plain');
    expect(args).toContain('--toc');
    expect(args).not.toContain('/tmp/secret');
    expect(args[args.indexOf('--output') + 1]).toBe(targetPath);
  });
});
