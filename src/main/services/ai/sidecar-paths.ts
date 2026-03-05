import { app } from 'electron';
import * as path from 'node:path';

const SIDECAR_DIRECTORY = 'sidecar';
const SIDECAR_BINARY_NAME = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';

/**
 * Gets ordered candidate paths for the bundled sidecar binary.
 *
 * In packaged builds, only process.resourcesPath/sidecar is valid.
 * In dev/dist launches, probe appPath-relative candidates and cwd fallback.
 */
export function getBundledSidecarBinaryPathCandidates(): string[] {
  if (app.isPackaged) {
    return [path.join(process.resourcesPath, SIDECAR_DIRECTORY, SIDECAR_BINARY_NAME)];
  }

  const appPath = app.getAppPath();

  return Array.from(new Set([
    path.resolve(appPath, 'resources', SIDECAR_DIRECTORY, SIDECAR_BINARY_NAME),
    path.resolve(appPath, '..', 'resources', SIDECAR_DIRECTORY, SIDECAR_BINARY_NAME),
    path.resolve(appPath, '..', '..', 'resources', SIDECAR_DIRECTORY, SIDECAR_BINARY_NAME),
  ]));
}
