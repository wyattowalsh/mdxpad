import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PandocBridge, PandocRawExporter } from '../pandoc-bridge';
import type { ExportOptions } from '../types';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  lstat: vi.fn().mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' })),
  unlink: vi.fn().mockResolvedValue(undefined),
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

  it('does not send YAML metadata to pandoc', async () => {
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

    const result = await bridge.export({
      content: '---\ntitle: Hello\nauthor: Ada\n---\n\nBody text.\n',
      outputPath: '/tmp/frontmatter.html',
    });

    expect(result.ok).toBe(true);
    const sent = mockStdin.write.mock.calls[0]?.[0] as string;
    expect(sent).toContain('Body text.');
    expect(sent).not.toContain('title: Hello');
    expect(sent).not.toContain('author: Ada');
  });

  it('does not send a local file address to pandoc', async () => {
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

    const result = await bridge.export({
      content: [
        '![Secret](/etc/passwd.png)',
        '',
        '[Disk](file:///etc/passwd)',
        '',
        '[Run](javascript:alert(1))',
        '',
        '![Pixel](pixel.png)',
        '',
        '[Docs](https://example.com)',
      ].join('\n'),
      outputPath: '/tmp/out.html',
    });

    expect(result.ok).toBe(true);
    const sent = mockStdin.write.mock.calls[0]?.[0] as string;
    expect(sent).not.toContain('/etc/passwd');
    expect(sent).not.toContain('file:');
    expect(sent).not.toContain('javascript:');
    expect(sent).toContain('![Pixel](pixel.png)');
    expect(sent).toContain('https://example.com');
    expect(sent).toContain('Secret');
    expect(sent).toContain('Disk');
  });

  it('sends the words of an HTML block', async () => {
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

    const result = await bridge.export({
      content: '<div>Hello <b>there</b></div>\n\n<a href="file:///etc/passwd">Disk</a>\n',
      outputPath: '/tmp/html.md',
    });

    expect(result.ok).toBe(true);
    const sent = mockStdin.write.mock.calls[0]?.[0] as string;
    expect(sent).toContain('Hello **there**');
    expect(sent).toContain('Disk');
    expect(sent).not.toContain('<div');
    expect(sent).not.toContain('<b>');
    expect(sent).not.toContain('file:');
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

  it('sends an escaped dollar as one formula', async () => {
    const { detectPandoc } = await import('../pandoc-detector');
    (detectPandoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      available: true,
      path: '/usr/bin/pandoc',
    });
    const { execFile } = await import('node:child_process');
    const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
    const write = vi.fn();
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(null, '', '');
        return { stdin: { write, end: vi.fn() } };
      }
    );

    await bridge.export({
      content: 'Price \\(\\$5\\) and \\(a$b\\).',
      outputPath: '/tmp/math.html',
    });

    const sent = String(write.mock.calls[0]?.[0]);
    expect(sent).toContain('$\\$5$');
    expect(sent).toContain('$a\\$b$');
  });

  it('keeps a raw TeX block from reading a file', async () => {
    const latex = new PandocBridge({ targetFormat: 'latex', sourceFormat: 'markdown' });
    const { detectPandoc } = await import('../pandoc-detector');
    (detectPandoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      available: true,
      path: '/usr/bin/pandoc',
    });
    const { execFile } = await import('node:child_process');
    const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
    const write = vi.fn();
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(null, '', '');
        return { stdin: { write, end: vi.fn() } };
      }
    );

    await latex.export({
      content: '```{=latex}\n\\input{secret.tex}\n```\n\n```\n\\input{secret.tex}\n```\n',
      outputPath: '/tmp/raw.tex',
    });

    const sent = String(write.mock.calls[0]?.[0]);
    const raw = sent.slice(0, sent.indexOf('```\n\\input{secret.tex}'));
    expect(raw).toContain('\\relax input');
    expect(raw).not.toContain('\\input');
    expect(sent).toContain('```\n\\input{secret.tex}\n```');
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
    const args = mockExecFile.mock.calls[0]?.[1] as string[];
    expect(args).toEqual(expect.arrayContaining(['--to', 'rst', '--from', 'markdown']));
    expect(args).not.toContain('--mathml');
    expect(args).not.toContain('--metadata');
  });

  it('keeps a preset flag and drops an output override', async () => {
    const { detectPandoc } = await import('../pandoc-detector');
    (detectPandoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      available: true,
      path: '/usr/bin/pandoc',
      version: '3.1.0',
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
      content: '# Hi',
      outputPath: '/tmp/out.html',
      metadata: {
        to: '../html',
        from: 'markdown',
        timeoutMs: 1000,
        extraArgs: ['--toc', '--toc-depth', '2', '--tab-stop=4', '--output', '/tmp/secret'],
      },
    });

    expect(result.ok).toBe(true);
    const args = mockExecFile.mock.calls[0]?.[1] as string[];
    const options = mockExecFile.mock.calls[0]?.[2] as { timeout?: number };
    expect(args).toContain('--toc');
    expect(args).toContain('--toc-depth');
    expect(args[args.indexOf('--toc-depth') + 1]).toBe('2');
    expect(args).toContain('--tab-stop=4');
    expect(args).toContain('--to');
    expect(args[args.indexOf('--to') + 1]).toBe('html');
    expect(args).not.toContain('/tmp/secret');
    expect(args.filter((arg) => arg === '--output')).toHaveLength(1);
    expect(args[args.indexOf('--output') + 1]).toBe('/tmp/out.html');
    expect(options.timeout).toBe(1000);
  });

  it('writes a standalone HTML file with MathML', async () => {
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
      content: 'See $x^2$.',
      outputPath: '/tmp/note.html',
    });

    expect(result.ok).toBe(true);
    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/bin/pandoc',
      expect.arrayContaining([
        '--from',
        'markdown+tex_math_dollars',
        '--to',
        'html',
        '--standalone',
        '--mathml',
      ]),
      expect.any(Object),
      expect.any(Function)
    );
  });
});
