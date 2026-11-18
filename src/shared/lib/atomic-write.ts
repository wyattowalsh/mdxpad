/**
 * Atomic file write utility.
 *
 * Writes content to a temporary file, then renames to the target path.
 * This ensures the target file is either fully written or doesn't exist,
 * preventing partial writes that could corrupt data.
 *
 * Per FR-015: Atomic write pattern to prevent corruption during crashes.
 *
 * @module shared/lib/atomic-write
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/** Default temp file suffix */
const TEMP_SUFFIX = '.tmp';

/** Directory flush errors on platforms that cannot fsync a folder. */
const DIRECTORY_SYNC_UNSUPPORTED = new Set(['EISDIR', 'EPERM', 'ENOTSUP', 'EINVAL']);

export type AtomicWritePhase =
  | 'before-write-temp'
  | 'after-write-temp'
  | 'before-commit'
  | 'after-commit'
  | 'cleanup';

export interface AtomicWriteDurabilityContext {
  readonly targetPath: string;
  readonly tempPath: string;
  readonly tempSuffix: string;
  readonly contentLength: number;
}

export interface AtomicWriteDurabilityContract {
  readonly onPhase?: (
    phase: AtomicWritePhase,
    context: AtomicWriteDurabilityContext
  ) => void | Promise<void>;
  readonly onError?: (
    error: unknown,
    context: AtomicWriteDurabilityContext
  ) => void | Promise<void>;
}

export interface AtomicWriteOptions {
  readonly tempSuffix?: string;
  readonly durabilityContract?: AtomicWriteDurabilityContract;
}

/**
 * Performs an atomic write operation.
 *
 * @param targetPath - Final destination path
 * @param content - Content to write
 * @param tempSuffix - Suffix for temporary file (defaults to '.tmp')
 */
export async function atomicWrite(
  targetPath: string,
  content: string,
  tempSuffixOrOptions: string | AtomicWriteOptions = TEMP_SUFFIX
): Promise<void> {
  const { tempSuffix, durabilityContract } = resolveAtomicWriteOptions(tempSuffixOrOptions);
  const tempPath = `${targetPath}${tempSuffix}`;
  const context: AtomicWriteDurabilityContext = {
    targetPath,
    tempPath,
    tempSuffix,
    contentLength: Buffer.byteLength(content, 'utf-8'),
  };

  await invokeDurabilityPhaseHook(durabilityContract, 'before-write-temp', context);

  try {
    await fs.writeFile(tempPath, content, 'utf-8');
    await syncFile(tempPath);
    await invokeDurabilityPhaseHook(durabilityContract, 'after-write-temp', context);
    await invokeDurabilityPhaseHook(durabilityContract, 'before-commit', context);
    await fs.rename(tempPath, targetPath);
    await syncFile(targetPath);
    await syncDirectory(path.dirname(targetPath));
    await invokeDurabilityPhaseHook(durabilityContract, 'after-commit', context);
  } catch (err) {
    // Best-effort cleanup — ignore errors (file may not exist)
    await fs.unlink(tempPath).catch(() => {
      /* intentional noop */
    });
    await invokeDurabilityPhaseHook(durabilityContract, 'cleanup', context);
    await invokeDurabilityErrorHook(durabilityContract, err, context);
    throw err;
  }
}

async function syncFile(filePath: string): Promise<void> {
  if (typeof fs.open !== 'function') {
    return;
  }
  const handle = await fs.open(filePath, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String(error.code);
  }
  return '';
}

async function syncDirectory(directory: string): Promise<void> {
  if (typeof fs.open !== 'function') {
    return;
  }
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(directory, 'r');
    await handle.sync();
  } catch (error) {
    if (!DIRECTORY_SYNC_UNSUPPORTED.has(errorCode(error))) {
      throw error;
    }
  } finally {
    await handle?.close();
  }
}

function resolveAtomicWriteOptions(tempSuffixOrOptions: string | AtomicWriteOptions): Readonly<{
  tempSuffix: string;
  durabilityContract?: AtomicWriteDurabilityContract;
}> {
  if (typeof tempSuffixOrOptions === 'string') {
    return {
      tempSuffix: tempSuffixOrOptions,
    };
  }

  const resolved: {
    tempSuffix: string;
    durabilityContract?: AtomicWriteDurabilityContract;
  } = {
    tempSuffix: tempSuffixOrOptions.tempSuffix ?? TEMP_SUFFIX,
  };

  if (tempSuffixOrOptions.durabilityContract !== undefined) {
    resolved.durabilityContract = tempSuffixOrOptions.durabilityContract;
  }

  return resolved;
}

async function invokeDurabilityPhaseHook(
  contract: AtomicWriteDurabilityContract | undefined,
  phase: AtomicWritePhase,
  context: AtomicWriteDurabilityContext
): Promise<void> {
  if (contract?.onPhase === undefined) {
    return;
  }

  await Promise.resolve(contract.onPhase(phase, context)).catch(() => {
    // Durability hooks are currently best-effort scaffolding.
  });
}

async function invokeDurabilityErrorHook(
  contract: AtomicWriteDurabilityContract | undefined,
  error: unknown,
  context: AtomicWriteDurabilityContext
): Promise<void> {
  if (contract?.onError === undefined) {
    return;
  }

  await Promise.resolve(contract.onError(error, context)).catch(() => {
    // Durability hooks are currently best-effort scaffolding.
  });
}
