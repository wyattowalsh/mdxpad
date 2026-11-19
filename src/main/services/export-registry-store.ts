/**
 * Persist export jobs and presets without following a link to another file.
 */

import {
  closeSync,
  constants,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { ExportJobSchema, ExportPresetSchema } from '@shared/types/export-model';
import type { ExportJob, ExportPreset } from '@shared/types/export-model';

import { ensureRealDirectorySync } from './ensure-real-directory';
import { BUILT_IN_EXPORT_PRESETS } from './built-in-export-presets';

const DIRECTORY_SYNC_UNSUPPORTED = new Set(['EISDIR', 'EPERM', 'ENOTSUP', 'EINVAL']);

interface ExportRegistryData {
  readonly jobs: ExportJob[];
  readonly presets: ExportPreset[];
  readonly deletedBuiltInIds: string[];
}

const EMPTY_REGISTRY: ExportRegistryData = { jobs: [], presets: [], deletedBuiltInIds: [] };

function parseItems<T>(value: unknown, parse: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const parsed = parse(item);
    return parsed === null ? [] : [parsed];
  });
}

function parseRegistry(raw: string): ExportRegistryData {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return EMPTY_REGISTRY;
    }
    const record = parsed as Record<string, unknown>;
    return {
      jobs: parseItems(record.jobs, (item) => {
        const result = ExportJobSchema.safeParse(item);
        return result.success ? result.data : null;
      }),
      presets: parseItems(record.presets, (item) => {
        const result = ExportPresetSchema.safeParse(item);
        return result.success ? result.data : null;
      }),
      deletedBuiltInIds: parseItems(record.deletedBuiltInIds, (item) =>
        typeof item === 'string' ? item : null
      ),
    };
  } catch {
    return EMPTY_REGISTRY;
  }
}

function readLocalText(filePath: string): string | null {
  try {
    const info = lstatSync(filePath);
    if (info.isSymbolicLink() || !info.isFile()) {
      return null;
    }
    const handle = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      return readFileSync(handle, 'utf8');
    } finally {
      closeSync(handle);
    }
  } catch {
    return null;
  }
}

function replaceTempLink(filePath: string): void {
  try {
    const info = lstatSync(filePath);
    if (info.isSymbolicLink()) {
      unlinkSync(filePath);
    }
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
    if (code !== 'ENOENT') {
      throw error;
    }
  }
}

function syncDirectory(directory: string): void {
  let handle: number | null = null;
  try {
    handle = openSync(directory, constants.O_RDONLY);
    fsyncSync(handle);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
    if (!DIRECTORY_SYNC_UNSUPPORTED.has(String(code))) {
      throw error;
    }
  } finally {
    if (handle !== null) {
      closeSync(handle);
    }
  }
}

function builtInById(): Map<string, ExportPreset> {
  return new Map(BUILT_IN_EXPORT_PRESETS.map((preset) => [preset.id, preset]));
}

function samePreset(left: ExportPreset, right: ExportPreset): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function readExportState(filePath: string): {
  jobs: Map<string, ExportJob>;
  presets: Map<string, ExportPreset>;
} {
  let raw: string | null = null;
  try {
    ensureRealDirectorySync(path.dirname(filePath));
    raw = readLocalText(filePath);
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : '';
    if (code !== 'ENOTDIR') {
      throw error;
    }
  }
  const stored = raw === null ? EMPTY_REGISTRY : parseRegistry(raw);
  const deleted = new Set(stored.deletedBuiltInIds);
  const presets = new Map<string, ExportPreset>();
  for (const preset of BUILT_IN_EXPORT_PRESETS) {
    if (!deleted.has(preset.id)) {
      presets.set(preset.id, structuredClone(preset));
    }
  }
  for (const preset of stored.presets) {
    presets.set(preset.id, structuredClone(preset));
  }
  const jobs = new Map(stored.jobs.map((job) => [job.id, structuredClone(job)]));
  return { jobs, presets };
}

export function writeExportState(
  filePath: string,
  jobs: Iterable<ExportJob>,
  presets: Iterable<ExportPreset>
): void {
  const builtIns = builtInById();
  const presetList = [...presets];
  const present = new Set(presetList.map((preset) => preset.id));
  const data: ExportRegistryData = {
    jobs: [...jobs].map((job) => structuredClone(job)),
    presets: presetList
      .filter((preset) => {
        const builtIn = builtIns.get(preset.id);
        return builtIn === undefined || !samePreset(builtIn, preset);
      })
      .map((preset) => structuredClone(preset)),
    deletedBuiltInIds: [...builtIns.keys()].filter((id) => !present.has(id)),
  };
  ensureRealDirectorySync(path.dirname(filePath));
  const tempPath = `${filePath}.${process.pid}.tmp`;
  replaceTempLink(tempPath);
  const handle = openSync(
    tempPath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
    0o600
  );
  try {
    writeFileSync(handle, JSON.stringify(data));
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
  renameSync(tempPath, filePath);
  syncDirectory(path.dirname(filePath));
}
