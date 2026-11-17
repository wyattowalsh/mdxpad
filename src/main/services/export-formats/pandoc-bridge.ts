import { execFile } from 'node:child_process';

import type { Exporter, ExportOptions, ExportResult } from './types';
import { detectPandoc } from './pandoc-detector';

const DEFAULT_TIMEOUT_MS = 30_000;
const CONTROL_METADATA = new Set(['to', 'from', 'timeoutMs', 'extraArgs']);

function htmlWriterArgs(targetFormat: string, extraArgs: readonly string[]): string[] {
  const args = [...extraArgs];
  if (targetFormat !== 'html' && targetFormat !== 'html5') {
    return args;
  }
  if (!args.includes('--standalone') && !args.includes('-s')) {
    args.push('--standalone');
  }
  if (!args.includes('--mathml') && !args.includes('--katex') && !args.includes('--mathjax')) {
    args.push('--mathml');
  }
  return args;
}

function runPandoc(
  pandocPath: string,
  args: string[],
  stdin: string,
  timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      pandocPath,
      args,
      { timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const err = error instanceof Error ? error : new Error('Pandoc execution failed');
          reject(err);
          return;
        }
        resolve({ stdout, stderr });
      }
    );

    if (child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

function buildPandocArgs(bridge: PandocBridge, options: ExportOptions): string[] {
  const args = [
    '--from',
    bridge.sourceFormat,
    '--to',
    bridge.targetFormat,
    '--output',
    options.outputPath,
    ...bridge.extraArgs,
  ];

  if (options.metadata) {
    for (const [key, value] of Object.entries(options.metadata)) {
      if (CONTROL_METADATA.has(key) || typeof value !== 'string') {
        continue;
      }
      args.push('--metadata', `${key}=${value}`);
    }
  }

  if (options.title) {
    args.push('--metadata', `title=${options.title}`);
  }

  if (options.author) {
    args.push('--metadata', `author=${options.author}`);
  }

  return args;
}

export class PandocBridge implements Exporter {
  readonly format: string;
  readonly label: string;
  readonly extension: string;
  readonly mimeType: string;
  readonly targetFormat: string;
  readonly sourceFormat: string;
  readonly extraArgs: string[];

  private readonly timeoutMs: number;

  constructor(options: {
    targetFormat: string;
    sourceFormat?: string;
    label?: string;
    extension?: string;
    mimeType?: string;
    timeoutMs?: number;
    extraArgs?: string[];
  }) {
    this.targetFormat = options.targetFormat;
    this.sourceFormat = options.sourceFormat ?? 'markdown';
    this.format = `pandoc-${options.targetFormat}`;
    this.label = options.label ?? `Pandoc (${options.targetFormat})`;
    this.extension = options.extension ?? options.targetFormat;
    this.mimeType = options.mimeType ?? 'application/octet-stream';
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.extraArgs = options.extraArgs ?? [];
  }

  async export(options: ExportOptions): Promise<ExportResult> {
    const warnings: string[] = [];

    try {
      const detection = await detectPandoc();
      if (!detection.available || !detection.path) {
        return {
          ok: false,
          error:
            'Pandoc is not installed. Please install pandoc from https://pandoc.org/installing.html',
          warnings,
        };
      }

      const args = buildPandocArgs(this, options);
      const { stderr } = await runPandoc(detection.path, args, options.content, this.timeoutMs);

      if (stderr.trim().length > 0) {
        warnings.push(`Pandoc warnings: ${stderr.trim()}`);
      }

      return { ok: true, outputPath: options.outputPath, warnings };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pandoc export failed';
      return { ok: false, error: message, warnings };
    }
  }
}

export class PandocRawExporter implements Exporter {
  readonly format = 'pandoc';
  readonly label = 'Pandoc (Custom)';
  readonly extension = 'txt';
  readonly mimeType = 'application/octet-stream';

  async export(options: ExportOptions): Promise<ExportResult> {
    const meta = options.metadata ?? {};
    const targetFormat = (meta.to as string | undefined) ?? 'html';
    const sourceFormat = (meta.from as string | undefined) ?? 'markdown+tex_math_dollars';
    const timeoutMs = (meta.timeoutMs as number | undefined) ?? DEFAULT_TIMEOUT_MS;
    const extraArgs = htmlWriterArgs(targetFormat, (meta.extraArgs as string[] | undefined) ?? []);

    const bridge = new PandocBridge({
      targetFormat,
      sourceFormat,
      timeoutMs,
      extraArgs,
    });

    return bridge.export(options);
  }
}
