import { spawn } from 'node:child_process';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type { ExportCliInvokeRequest } from '@shared/contracts/export-schemas';
import { atomicWrite } from '@shared/lib/atomic-write';
import type { ExportCliEvent, ExportCliOutput } from '@shared/types/export-model';
import { DocxExportPresetOptionsSchema, PdfExportPresetOptionsSchema } from '@shared/types/root';

import { buildDocxDocument, buildPdfDocument } from './export-document-builders';
import { getExporter } from './export-formats';
import { serializeForExport } from './export-service';

/**
 * Allowlisted commands that may be executed. All others are rejected.
 * @internal Exported for test-only manipulation via beforeEach/afterEach.
 */
export const ALLOWED_COMMANDS = new Set(['mdxpad-export']);

/** Environment variables allowed to be passed to spawned processes. */
const ALLOWED_ENV_KEYS = new Set([
  'PATH',
  'HOME',
  'TMPDIR',
  'TEMP',
  'TMP',
  'NODE_ENV',
  'LANG',
  'LC_ALL',
]);

type CliEventLevel = ExportCliEvent['level'];

interface SpawnCommandResult {
  readonly ok: boolean;
  readonly child?: ChildProcess;
  readonly error?: string;
}

export interface CliEngineRunResult {
  readonly output: ExportCliOutput;
  readonly timedOut: boolean;
  readonly spawnError: string | null;
}

function createCliEvent(level: CliEventLevel, message: string): ExportCliEvent {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return String(error);
}

function formatValidationIssues(
  issues: readonly { path: (string | number)[]; message: string }[]
): string {
  return issues.map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`).join('; ');
}

function formatCommandLine(command: string, args: readonly string[]): string {
  const encodedArgs = args.map((arg) => (/\s/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg));
  return [command, ...encodedArgs].join(' ').trim();
}

function getRequestArgs(request: ExportCliInvokeRequest): readonly string[] {
  return Array.isArray(request.args) ? request.args : [];
}

function appendChunkEvents(
  events: ExportCliEvent[],
  level: CliEventLevel,
  chunk: Buffer | string
): void {
  const lines = chunk
    .toString()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    events.push(createCliEvent(level, line));
  }
}

function createCliOutput(
  request: ExportCliInvokeRequest,
  startTimeMs: number,
  exitCode: number,
  events: ExportCliEvent[],
  options: {
    readonly pid?: number;
    readonly background?: boolean;
  } = {}
): ExportCliOutput {
  const output: ExportCliOutput = {
    job: request.job,
    exitCode: Math.max(0, exitCode),
    durationMs: Math.max(0, Date.now() - startTimeMs),
    commandLine: formatCommandLine(request.command, getRequestArgs(request)),
    events,
  };

  if (exitCode === 0) {
    output.artifactPath = request.job.targetPath;
  }

  if (typeof options.pid === 'number' && Number.isInteger(options.pid) && options.pid > 0) {
    output.pid = options.pid;
  }

  if (typeof options.background === 'boolean') {
    output.background = options.background;
  }

  return output;
}

function createSpawnOptions(request: ExportCliInvokeRequest): SpawnOptions {
  const baseEnv: Record<string, string> = {};
  for (const key of ALLOWED_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined) {
      baseEnv[key] = value;
    }
  }
  if (request.env) {
    for (const [key, value] of Object.entries(request.env)) {
      if (ALLOWED_ENV_KEYS.has(key)) {
        baseEnv[key] = value;
      }
    }
  }
  return {
    cwd: request.cwd,
    env: baseEnv,
    shell: false,
    detached: request.background ?? false,
    stdio: request.background ? 'ignore' : 'pipe',
  };
}

function assertPathWithinBase(
  targetPath: string,
  basePath: string | undefined,
  label: string
): void {
  if (!basePath) return; // No base to validate against
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(basePath);
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    throw new Error(`${label} "${resolved}" escapes the allowed base directory "${resolvedBase}"`);
  }
}

function isAllowedCommand(command: string): boolean {
  return ALLOWED_COMMANDS.has(command.trim());
}

function isBuiltInExportCommand(request: ExportCliInvokeRequest): boolean {
  return request.command.trim() === 'mdxpad-export';
}

async function writeBinaryAtomically(targetPath: string, content: Uint8Array): Promise<void> {
  const tempPath = `${targetPath}.tmp`;
  try {
    await fs.writeFile(tempPath, content);
    await fs.rename(tempPath, targetPath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

async function writeBuiltInExportArtifact(
  request: ExportCliInvokeRequest,
  sourceContent: string
): Promise<string[]> {
  const warnings: string[] = [];

  switch (request.job.format) {
    case 'pdf': {
      const parsedOptions = PdfExportPresetOptionsSchema.safeParse(request.job.preset.options);
      if (!parsedOptions.success) {
        throw new Error(formatValidationIssues(parsedOptions.error.issues));
      }
      const built = buildPdfDocument(sourceContent, parsedOptions.data);
      warnings.push(...built.warnings);
      await atomicWrite(request.job.targetPath, built.content);
      return warnings;
    }
    case 'docx': {
      const parsedOptions = DocxExportPresetOptionsSchema.safeParse(request.job.preset.options);
      if (!parsedOptions.success) {
        throw new Error(formatValidationIssues(parsedOptions.error.issues));
      }
      const built = buildDocxDocument(sourceContent, parsedOptions.data);
      warnings.push(...built.warnings);
      await writeBinaryAtomically(request.job.targetPath, built.content);
      return warnings;
    }
    default: {
      const exporter = getExporter(request.job.format);
      if (exporter) {
        const result = await exporter.export({
          content: sourceContent,
          outputPath: request.job.targetPath,
          title: request.job.preset.name,
        });
        if (!result.ok) {
          throw new Error(result.error ?? `Could not export ${request.job.format}`);
        }
        return [...result.warnings];
      }
      const serialized = serializeForExport(sourceContent, request.job.format);
      if (!serialized.ok) {
        throw new Error(serialized.error.message);
      }
      warnings.push(...serialized.warnings);
      await atomicWrite(request.job.targetPath, serialized.content);
      return warnings;
    }
  }
}

async function runBuiltInExportCommand(
  request: ExportCliInvokeRequest,
  startTimeMs: number,
  events: ExportCliEvent[]
): Promise<CliEngineRunResult> {
  try {
    if (!request.job.sourcePath) {
      throw new Error('Built-in export requires a sourcePath on the export job');
    }

    const sourceContent = await fs.readFile(request.job.sourcePath, 'utf-8');
    assertPathWithinBase(request.job.targetPath, request.cwd, 'Target path');
    await fs.mkdir(path.dirname(request.job.targetPath), { recursive: true });
    const warnings = await writeBuiltInExportArtifact(request, sourceContent);

    for (const warning of warnings) {
      events.push(createCliEvent('warn', warning));
    }
    events.push(createCliEvent('success', `Export written to ${request.job.targetPath}`));

    return {
      output: createCliOutput(request, startTimeMs, 0, events),
      timedOut: false,
      spawnError: null,
    };
  } catch (error) {
    events.push(createCliEvent('error', toErrorMessage(error)));
    return {
      output: createCliOutput(request, startTimeMs, 1, events),
      timedOut: false,
      spawnError: null,
    };
  }
}

function spawnCommand(request: ExportCliInvokeRequest): SpawnCommandResult {
  try {
    return {
      ok: true,
      child: spawn(request.command, getRequestArgs(request), createSpawnOptions(request)),
    };
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    };
  }
}

function scheduleCommandTimeout(
  child: ChildProcess,
  timeoutMs: number | undefined,
  onTimeout: () => void
): NodeJS.Timeout | undefined {
  if (timeoutMs === undefined) {
    return undefined;
  }

  return setTimeout(() => {
    onTimeout();
    child.kill('SIGTERM');
  }, timeoutMs);
}

function createSpawnFailureResult(
  request: ExportCliInvokeRequest,
  startTimeMs: number,
  events: ExportCliEvent[],
  error?: string
): CliEngineRunResult {
  const message = error ?? 'Failed to spawn command';
  return {
    output: createCliOutput(request, startTimeMs, 1, [...events, createCliEvent('error', message)]),
    timedOut: false,
    spawnError: message,
  };
}

function runBackgroundCommand(
  request: ExportCliInvokeRequest,
  startTimeMs: number,
  events: ExportCliEvent[],
  child: ChildProcess
): CliEngineRunResult {
  child.unref();
  const pid = typeof child.pid === 'number' ? child.pid : undefined;
  events.push(
    createCliEvent(
      'success',
      pid ? `Command started in background (pid ${pid})` : 'Command started in background'
    )
  );
  return {
    output: createCliOutput(request, startTimeMs, 0, events, {
      ...(pid !== undefined ? { pid } : {}),
      background: true,
    }),
    timedOut: false,
    spawnError: null,
  };
}

async function runForegroundCommand(
  request: ExportCliInvokeRequest,
  startTimeMs: number,
  events: ExportCliEvent[],
  child: ChildProcess
): Promise<CliEngineRunResult> {
  child.stdout?.on('data', (chunk: Buffer | string) => appendChunkEvents(events, 'info', chunk));
  child.stderr?.on('data', (chunk: Buffer | string) => appendChunkEvents(events, 'warn', chunk));

  return await new Promise((resolve) => {
    let settled = false;
    let timedOut = false;

    const timeoutHandle = scheduleCommandTimeout(child, request.timeoutMs, () => {
      timedOut = true;
      events.push(createCliEvent('error', `Command timed out after ${request.timeoutMs}ms`));
    });

    const finalize = (result: CliEngineRunResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      resolve(result);
    };

    child.once('error', (error: Error) => {
      const message = toErrorMessage(error);
      events.push(createCliEvent('error', message));
      finalize({
        output: createCliOutput(request, startTimeMs, 1, events),
        timedOut: false,
        spawnError: message,
      });
    });

    child.once('close', (code) => {
      finalize({
        output: createCliOutput(request, startTimeMs, code ?? 1, events),
        timedOut,
        spawnError: null,
      });
    });
  });
}

export async function runCliAutomationCommand(
  request: ExportCliInvokeRequest
): Promise<CliEngineRunResult> {
  const startTimeMs = Date.now();
  const events: ExportCliEvent[] = [
    createCliEvent(
      'info',
      `Running command: ${formatCommandLine(request.command, getRequestArgs(request))}`
    ),
  ];

  if (!isAllowedCommand(request.command)) {
    return createSpawnFailureResult(
      request,
      startTimeMs,
      events,
      `Command "${request.command}" is not in the allowed commands list`
    );
  }

  if (isBuiltInExportCommand(request)) {
    events.push(
      createCliEvent(
        'info',
        `Using built-in ${request.job.format.toUpperCase()} exporter for preset "${request.job.preset.name}"`
      )
    );
    return runBuiltInExportCommand(request, startTimeMs, events);
  }

  const spawned = spawnCommand(request);
  if (!spawned.ok || !spawned.child) {
    return createSpawnFailureResult(request, startTimeMs, events, spawned.error);
  }

  if (request.background) {
    return runBackgroundCommand(request, startTimeMs, events, spawned.child);
  }

  return runForegroundCommand(request, startTimeMs, events, spawned.child);
}
