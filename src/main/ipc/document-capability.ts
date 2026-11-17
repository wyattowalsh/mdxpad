import * as path from 'node:path';

const SCHEMA_SIDE_CAR_DIR = '.mdxpad';
const SCHEMA_SIDE_CAR_FILE = 'schema.json';

const readCapabilities = new Set<string>();
const writeCapabilities = new Set<string>();
const documentDirectoryCapabilities = new Set<string>();

export function normalizeCapabilityPath(filePath: string): string | null {
  if (filePath.length === 0 || filePath.includes('\0')) {
    return null;
  }

  const normalized = path.resolve(filePath);
  return path.isAbsolute(normalized) ? normalized : null;
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
