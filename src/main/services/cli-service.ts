import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import {
  ExportCliInvokeRequestSchema,
  ExportCliInvokeResponseSchema,
  LlmsGenerationRequestSchema,
  LlmsGenerationResponseSchema,
  type ExportCliInvokeRequest,
  type ExportCliInvokeResponse,
  type LlmsGenerationRequest,
  type LlmsGenerationResponse,
  type LlmsTarget,
} from '@shared/contracts/export-schemas';
import { hasReadCapability } from '@main/ipc/document-capability';
import { atomicWrite } from '@shared/lib/atomic-write';

import { resolveWorkspaceFilePath, WorkspacePathError } from './ai/agent-path';
import { runCliAutomationCommand } from './cli-engine';
import { generateLlmsContent } from './llms-generator';

class LlmsScopeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'LlmsScopeError';
  }
}

class LlmsOutputExistsError extends Error {
  public constructor(outputPath: string) {
    super(`Output file already exists: ${outputPath}`);
    this.name = 'LlmsOutputExistsError';
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return String(error);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function formatZodError(error: {
  issues: { path: (string | number)[]; message: string }[];
}): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`)
    .join('; ');
}

function parseCliValidationResult(
  result: ReturnType<typeof ExportCliInvokeRequestSchema.safeParse>
): ExportCliInvokeResponse | null {
  if (result.success) {
    return null;
  }
  return ExportCliInvokeResponseSchema.parse({
    ok: false,
    code: 'VALIDATION_ERROR',
    error: formatZodError(result.error),
  });
}

async function assertLlmsOutputWritable(outputPath: string, overwrite: boolean): Promise<void> {
  if (overwrite) {
    return;
  }

  try {
    await fs.access(outputPath);
    throw new LlmsOutputExistsError(outputPath);
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

function resolvedLlmsOutput(sourcePath: string | null | undefined, outputPath: string): string {
  if (sourcePath === null || sourcePath === undefined || !hasReadCapability(sourcePath)) {
    throw new LlmsScopeError('llms generation can only write beside a file that is open');
  }
  const sourceDir = path.dirname(sourcePath);
  const absoluteOutput = path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(sourceDir, outputPath);
  return resolveWorkspaceFilePath(sourceDir, path.relative(sourceDir, absoluteOutput));
}

function llmsErrorCodeFrom(error: unknown): 'WRITE_FAILED' | 'INTERNAL_ERROR' {
  if (
    error instanceof LlmsOutputExistsError ||
    error instanceof LlmsScopeError ||
    error instanceof WorkspacePathError
  ) {
    return 'WRITE_FAILED';
  }
  if (isErrnoException(error) && typeof error.code === 'string') {
    return 'WRITE_FAILED';
  }
  return 'INTERNAL_ERROR';
}

export function getDefaultLlmsOutputPath(
  sourcePath: string | null | undefined,
  target: LlmsTarget
): string {
  if (!sourcePath) {
    return target;
  }
  return path.join(path.dirname(sourcePath), target);
}

export async function invokeExportCli(
  request: ExportCliInvokeRequest
): Promise<ExportCliInvokeResponse> {
  const validated = ExportCliInvokeRequestSchema.safeParse(request);
  const validationError = parseCliValidationResult(validated);
  if (validationError) {
    return validationError;
  }

  // validated.data is defined because parseCliValidationResult returns early if validation fails
  if (!validated.data) {
    return ExportCliInvokeResponseSchema.parse({
      ok: false,
      code: 'INVALID_REQUEST',
      error: 'Request validation failed',
    });
  }
  const validatedData = validated.data;
  const runResult = await runCliAutomationCommand(validatedData);
  if (runResult.spawnError) {
    return ExportCliInvokeResponseSchema.parse({
      ok: false,
      code: 'SPAWN_FAILED',
      error: runResult.spawnError,
      output: runResult.output,
    });
  }
  if (runResult.timedOut) {
    return ExportCliInvokeResponseSchema.parse({
      ok: false,
      code: 'TIMEOUT',
      error: `Command timed out after ${validatedData.timeoutMs}ms`,
      output: runResult.output,
    });
  }
  if (runResult.output.exitCode !== 0) {
    return ExportCliInvokeResponseSchema.parse({
      ok: false,
      code: 'NON_ZERO_EXIT',
      error: `Command exited with code ${runResult.output.exitCode}`,
      output: runResult.output,
    });
  }

  return ExportCliInvokeResponseSchema.parse({
    ok: true,
    output: runResult.output,
  });
}

export async function generateLlmsFile(
  request: LlmsGenerationRequest
): Promise<LlmsGenerationResponse> {
  const validated = LlmsGenerationRequestSchema.safeParse(request);
  if (!validated.success) {
    return LlmsGenerationResponseSchema.parse({
      ok: false,
      code: 'VALIDATION_ERROR',
      error: formatZodError(validated.error),
    });
  }

  try {
    const outputPath = resolvedLlmsOutput(validated.data.sourcePath, validated.data.outputPath);
    await assertLlmsOutputWritable(outputPath, validated.data.overwrite);
    const generatedContent = generateLlmsContent({
      target: validated.data.target,
      content: validated.data.content,
      ...(validated.data.sourcePath !== undefined ? { sourcePath: validated.data.sourcePath } : {}),
      ...(validated.data.tagFilter !== undefined ? { tagFilter: validated.data.tagFilter } : {}),
    });
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await atomicWrite(outputPath, generatedContent);

    return LlmsGenerationResponseSchema.parse({
      ok: true,
      target: validated.data.target,
      path: outputPath,
      bytesWritten: Buffer.byteLength(generatedContent, 'utf-8'),
    });
  } catch (error) {
    return LlmsGenerationResponseSchema.parse({
      ok: false,
      code: llmsErrorCodeFrom(error),
      error: toErrorMessage(error),
    });
  }
}
