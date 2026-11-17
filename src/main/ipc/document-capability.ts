import * as fs from 'node:fs';
import * as path from 'node:path';

const SCHEMA_SIDE_CAR_DIR = '.mdxpad';
const SCHEMA_SIDE_CAR_FILE = 'schema.json';

const readCapabilities = new Set<string>();
const writeCapabilities = new Set<string>();
const documentDirectoryCapabilities = new Set<string>();

function isMissingPathError(error: unknown): boolean {
  if (!(error instanceof Error) || !('code' in error)) {
    return false;
  }

  const { code } = error;
  return code === 'ENOENT';
}

function canonicalizeExistingPath(target: string): string | null {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
}

function canonicalizeMissingPath(resolved: string): string | null {
  const parent = path.dirname(resolved);
  if (parent === resolved) {
    return null;
  }

  // Save As has no inode yet. Use the parent real path plus the basename.
  // A parent that cannot be canonicalized denies; do not keep the unresolved path.
  const parentPath = canonicalizeExistingPath(parent);
  if (parentPath === null) {
    return null;
  }

  return path.join(parentPath, path.basename(resolved));
}

function canonicalizeResolvedPath(resolved: string): string | null {
  try {
    return fs.realpathSync(resolved);
  } catch (error: unknown) {
    if (!isMissingPathError(error)) {
      return null;
    }
  }

  return canonicalizeMissingPath(resolved);
}

export function normalizeCapabilityPath(filePath: string): string | null {
  if (filePath.length === 0 || filePath.includes('\0')) {
    return null;
  }

  const resolved = path.resolve(filePath);
  if (!path.isAbsolute(resolved)) {
    return null;
  }

  return canonicalizeResolvedPath(resolved);
}

function isSchemaSidecarPath(normalizedPath: string): boolean {
  return (
    path.basename(normalizedPath).toLowerCase() === SCHEMA_SIDE_CAR_FILE &&
    path.basename(path.dirname(normalizedPath)).toLowerCase() === SCHEMA_SIDE_CAR_DIR
  );
}

export function grantReadCapability(filePath: string): void {
  const normalized = normalizeCapabilityPath(filePath);
  if (!normalized) {
    return;
  }

  readCapabilities.add(normalized);
  documentDirectoryCapabilities.add(path.dirname(normalized));
}

export function grantWriteCapability(filePath: string): void {
  const normalized = normalizeCapabilityPath(filePath);
  if (!normalized) {
    return;
  }

  grantReadCapability(normalized);
  writeCapabilities.add(normalized);
}

export function hasReadCapability(filePath: string): boolean {
  const normalized = normalizeCapabilityPath(filePath);
  if (!normalized) {
    return false;
  }

  if (readCapabilities.has(normalized)) {
    return true;
  }

  if (!isSchemaSidecarPath(normalized)) {
    return false;
  }

  const documentDir = path.dirname(path.dirname(normalized));
  return documentDirectoryCapabilities.has(documentDir);
}

export function hasWriteCapability(filePath: string): boolean {
  const normalized = normalizeCapabilityPath(filePath);
  return normalized !== null && writeCapabilities.has(normalized);
}

export function canBootstrapReadCapability(filePath: string): boolean {
  const normalized = normalizeCapabilityPath(filePath);
  if (!normalized) {
    return false;
  }

  if (!isSchemaSidecarPath(normalized)) {
    return false;
  }

  const documentDir = path.dirname(path.dirname(normalized));
  return documentDirectoryCapabilities.has(documentDir);
}

export function permissionDenied(pathValue: string): { code: 'PERMISSION_DENIED'; path: string } {
  return {
    code: 'PERMISSION_DENIED',
    path: normalizeCapabilityPath(pathValue) ?? pathValue,
  };
}

export function ensureWriteCapability(filePath: string): boolean {
  return hasWriteCapability(filePath);
}

export function resetFileCapabilities(): void {
  readCapabilities.clear();
  writeCapabilities.clear();
  documentDirectoryCapabilities.clear();
}
