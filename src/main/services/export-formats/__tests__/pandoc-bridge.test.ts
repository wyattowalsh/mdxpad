import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PandocBridge, PandocRawExporter } from '../pandoc-bridge';
import type { ExportOptions } from '../types';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('../pandoc-detector', () => ({
  detectPandoc: vi.fn(),
}));

describe('PandocBridge', () => {
  let bridge: PandocBridge;

  beforeEach(() => {
    bridge = new PandocBridge({
      targetFormat: 'html',
      sourceFormat: 'markdown',
    });
    vi.clearAllMocks();
  });

  it('has correct metadata', () => {
    expect(bridge.format).toBe('pandoc-html');
    expect(bridge.label).toBe('Pandoc (html)');
    expect(bridge.extension).toBe('html');
  });

  it('returns error when pandoc is not available', async () => {
    const { detectPandoc } = await import('../pandoc-detector');
    (detectPandoc as ReturnType<typeof vi.fn>).mockResolvedValue({ available: false });

    const options: ExportOptions = {
      content: '# Hello',
      outputPath: '/tmp/out.html',
    };

    const result = await bridge.export(options);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Pandoc is not installed');
  });

  it('calls pandoc with correct arguments', async () => {
    const { detectPandoc } = await import('../pandoc-detector');
    (detectPandoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      available: true,
      path: '/usr/local/bin/pandoc',
      version: '3.1.0',
    });

    const { execFile } = await import('node:child_process');
    const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
    const mockStdin = { write: vi.fn(), end: vi.fn() };
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(null, '', '');
        return { stdin: mockStdin };
      }
    );

    const options: ExportOptions = {
      content: '# Hello',
      title: 'My Title',
      author: 'Author',
      outputPath: '/tmp/out.html',
    };

    const result = await bridge.export(options);

    expect(result.ok).toBe(true);
    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/local/bin/pandoc',
      expect.arrayContaining(['--from', 'markdown', '--to', 'html', '--output', '/tmp/out.html']),
      expect.any(Object),
      expect.any(Function)
    );
    expect(mockStdin.write).toHaveBeenCalledWith('# Hello');
    expect(mockStdin.end).toHaveBeenCalledOnce();
  });

  it('includes pandoc stderr as warnings', async () => {
    const { detectPandoc } = await import('../pandoc-detector');
    (detectPandoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      available: true,
      path: '/usr/local/bin/pandoc',
    });

    const { execFile } = await import('node:child_process');
    const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(null, '', 'some warning\n');
        return { stdin: { write: vi.fn(), end: vi.fn() } };
      }
    );

    const result = await bridge.export({
      content: 'content',
      outputPath: '/tmp/out.html',
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('Pandoc warnings: some warning');
  });

  it('returns error when pandoc execution fails', async () => {
    const { detectPandoc } = await import('../pandoc-detector');
    (detectPandoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      available: true,
      path: '/usr/local/bin/pandoc',
    });

    const { execFile } = await import('node:child_process');
    const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(new Error('pandoc crashed'), '', '');
        return { stdin: { write: vi.fn(), end: vi.fn() } };
      }
    );

    const result = await bridge.export({
      content: 'content',
      outputPath: '/tmp/out.html',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('pandoc crashed');
  });

  it('supports custom options', () => {
    const custom = new PandocBridge({
      targetFormat: 'rst',
      label: 'RST',
      extension: 'rst',
      mimeType: 'text/x-rst',
      timeoutMs: 60_000,
      extraArgs: ['--standalone'],
    });

    expect(custom.format).toBe('pandoc-rst');
    expect(custom.label).toBe('RST');
    expect(custom.extension).toBe('rst');
    expect(custom.mimeType).toBe('text/x-rst');
  });

  it('passes metadata as pandoc --metadata flags', async () => {
    const { detectPandoc } = await import('../pandoc-detector');
    (detectPandoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      available: true,
      path: '/usr/bin/pandoc',
    });

    const { execFile } = await import('node:child_process');
    const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(null, '', '');
        return { stdin: { write: vi.fn(), end: vi.fn() } };
      }
    );

    await bridge.export({
      content: 'text',
      outputPath: '/tmp/meta.html',
      metadata: { lang: 'en' },
    });

    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/bin/pandoc',
      expect.arrayContaining(['--metadata', 'lang=en']),
      expect.any(Object),
      expect.any(Function)
    );
  });
});

describe('PandocRawExporter', () => {
  let exporter: PandocRawExporter;

  beforeEach(() => {
    exporter = new PandocRawExporter();
    vi.clearAllMocks();
  });

  it('has correct metadata', () => {
    expect(exporter.format).toBe('pandoc');
    expect(exporter.label).toBe('Pandoc (Custom)');
  });

  it('delegates to PandocBridge with metadata options', async () => {
    const { detectPandoc } = await import('../pandoc-detector');
    (detectPandoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      available: true,
      path: '/usr/bin/pandoc',
    });

    const { execFile } = await import('node:child_process');
    const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(null, '', '');
        return { stdin: { write: vi.fn(), end: vi.fn() } };
      }
    );

    const result = await exporter.export({
      content: '# Test',
      outputPath: '/tmp/custom.rst',
      metadata: {
        to: 'rst',
        from: 'markdown',
      },
    });

    expect(result.ok).toBe(true);
    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/bin/pandoc',
      expect.arrayContaining(['--to', 'rst']),
      expect.any(Object),
      expect.any(Function)
    );
  });
});
