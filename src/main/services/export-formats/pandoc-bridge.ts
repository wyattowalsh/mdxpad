import { execFile } from 'node:child_process';

import { fenceIndentedCode } from '@shared/lib/indented-code';
import { normalizeTexMath } from '@shared/lib/markdown-math';

import { inlineLocalImages } from './export-image';
import { sanitizeMarkdownHtmlBlocks } from './markdown-html';
import { omitLocalMarkdownTargets } from './omit-local-markdown-targets';
import { prepareRegularOutput } from './write-regular-file';
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

      await prepareRegularOutput(options.outputPath);
      const args = buildPandocArgs(this, options);
      const rooted = options.sourcePath
        ? await inlineLocalImages(options.content, options.sourcePath, 'resource')
        : options.content;
      const content = sanitizeMarkdownHtmlBlocks(
        omitLocalMarkdownTargets(normalizeTexMath(fenceIndentedCode(rooted)), options.sourcePath)
      );
      const { stderr } = await runPandoc(detection.path, args, content, this.timeoutMs);

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

const PANDOC_FORMAT = /^[A-Za-z0-9][A-Za-z0-9_+-]*$/;
const PANDOC_FLAG = /^--?[A-Za-z][A-Za-z0-9-]*$/;
const PANDOC_INTEGER = /^-?\d+$/;
const BLOCKED_PANDOC_ARGS = new Set([
  '-o',
  '--output',
  '--data-dir',
  '--defaults',
  '--filter',
  '--lua-filter',
  '--template',
  '--include-in-header',
  '--include-before-body',
  '--include-after-body',
  '--reference-doc',
  '--extract-media',
  '--log',
]);

function pandocFormat(value: unknown, fallback: string): string {
  return typeof value === 'string' && PANDOC_FORMAT.test(value) ? value : fallback;
}

function pandocFlagName(item: string): string {
  const equals = item.indexOf('=');
  return equals === -1 ? item : item.slice(0, equals);
}

function allowedPandocFlag(item: string): boolean {
  const name = pandocFlagName(item);
  if (BLOCKED_PANDOC_ARGS.has(name) || BLOCKED_PANDOC_ARGS.has(item)) {
    return false;
  }
  return (
    PANDOC_FLAG.test(name) && (item === name || PANDOC_INTEGER.test(item.slice(name.length + 1)))
  );
}

function stringEntries(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: string[] = [];
  for (const item of value as readonly unknown[]) {
    if (typeof item === 'string') {
      items.push(item);
    }
  }
  return items;
}

function pandocExtraArgs(value: unknown): string[] {
  const source = stringEntries(value);
  const args: string[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const item = source[index] ?? '';
    if (!allowedPandocFlag(item)) {
      continue;
    }
    args.push(item);
    const next = source[index + 1];
    if (!item.includes('=') && next !== undefined && PANDOC_INTEGER.test(next)) {
      args.push(next);
      index += 1;
    }
  }
  return args;
}

function pandocTimeout(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 120_000
    ? value
    : DEFAULT_TIMEOUT_MS;
}

function pandocBridgeOptions(metadata: Record<string, unknown> | undefined): {
  targetFormat: string;
  sourceFormat: string;
  timeoutMs: number;
  extraArgs: string[];
} {
  const targetFormat = pandocFormat(metadata?.to, 'html');
  const sourceFormat = pandocFormat(metadata?.from, 'markdown+tex_math_dollars');
  return {
    targetFormat,
    sourceFormat,
    timeoutMs: pandocTimeout(metadata?.timeoutMs),
    extraArgs: htmlWriterArgs(targetFormat, pandocExtraArgs(metadata?.extraArgs)),
  };
}

export class PandocRawExporter implements Exporter {
  readonly format = 'pandoc';
  readonly label = 'Pandoc (Custom)';
  readonly extension = 'txt';
  readonly mimeType = 'application/octet-stream';

  async export(options: ExportOptions): Promise<ExportResult> {
    const bridge = new PandocBridge(pandocBridgeOptions(options.metadata));

    return bridge.export(options);
  }
}
