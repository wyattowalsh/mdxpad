import { describe, it, expect, vi, beforeEach } from 'vitest';

import { detectPandoc, clearPandocCache } from '../pandoc-detector';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

describe('detectPandoc', () => {
  beforeEach(() => {
    clearPandocCache();
    vi.clearAllMocks();
  });

  it('detects pandoc when available', async () => {
    const { execFile } = await import('node:child_process');
    const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

    mockExecFile.mockImplementation(
      (
        cmd: string,
        args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        if (args[0] === 'pandoc') {
          callback(null, '/usr/local/bin/pandoc\n', '');
        } else if (args[0] === '--version') {
          callback(null, 'pandoc 3.1.2\nCompiled with pandoc-types 1.23', '');
        }
        return { stdin: null };
      }
    );

    const result = await detectPandoc(true);

    expect(result.available).toBe(true);
    expect(result.path).toBe('/usr/local/bin/pandoc');
    expect(result.version).toBe('3.1.2');
  });

  it('returns unavailable when which fails', async () => {
    const { execFile } = await import('node:child_process');
    const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(new Error('not found'), '', '');
        return { stdin: null };
      }
    );

    const result = await detectPandoc(true);

    expect(result.available).toBe(false);
    expect(result.version).toBeUndefined();
    expect(result.path).toBeUndefined();
  });

  it('caches results between calls', async () => {
    const { execFile } = await import('node:child_process');
    const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

    mockExecFile.mockImplementation(
      (
        _cmd: string,
        args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        if (args[0] === 'pandoc') {
          callback(null, '/usr/bin/pandoc\n', '');
        } else {
          callback(null, 'pandoc 3.0.0', '');
        }
        return { stdin: null };
      }
    );

    await detectPandoc(true);
    mockExecFile.mockClear();

    const cached = await detectPandoc();
    expect(cached.available).toBe(true);
    // Should not have called execFile again
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('refreshes cache when forceRefresh is true', async () => {
    const { execFile } = await import('node:child_process');
    const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(new Error('not found'), '', '');
        return { stdin: null };
      }
    );

    await detectPandoc(true);
    expect((await detectPandoc()).available).toBe(false);

    mockExecFile.mockImplementation(
      (
        _cmd: string,
        args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        if (args[0] === 'pandoc') {
          callback(null, '/usr/bin/pandoc\n', '');
        } else {
          callback(null, 'pandoc 3.2.0', '');
        }
        return { stdin: null };
      }
    );

    const refreshed = await detectPandoc(true);
    expect(refreshed.available).toBe(true);
  });
});
