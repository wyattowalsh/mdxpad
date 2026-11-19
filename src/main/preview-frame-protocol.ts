/**
 * Registers a custom protocol for preview-frame assets in production.
 *
 * This avoids sandboxed iframes loading file:// assets directly, which Chromium blocks
 * under strict sandbox settings (`allow-scripts` without `allow-same-origin`).
 */

import { net, protocol } from 'electron';
import { lstatSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PREVIEW_FRAME_SCHEME = 'mdxpad-preview';

protocol.registerSchemesAsPrivileged([
  {
    scheme: PREVIEW_FRAME_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

export function previewFrameAssetPath(requestUrl: string, rendererRoot: string): string | null {
  let pathFromRequest: string;

  try {
    const parsed = new URL(requestUrl);
    pathFromRequest = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }

  if (pathFromRequest.length === 0) {
    return null;
  }

  const normalizedRoot = resolve(rendererRoot);
  const resolvedPath = resolve(normalizedRoot, pathFromRequest);

  if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(`${normalizedRoot}${sep}`)) {
    return null;
  }
  return fileInsideRoot(resolvedPath, normalizedRoot) ? resolvedPath : null;
}

function fileInsideRoot(filePath: string, rendererRoot: string): boolean {
  try {
    const info = lstatSync(filePath);
    if (info.isSymbolicLink() || !info.isFile()) {
      return false;
    }
    const realRoot = realpathSync(rendererRoot);
    const realFile = realpathSync(filePath);
    return realFile === realRoot || realFile.startsWith(`${realRoot}${sep}`);
  } catch {
    return false;
  }
}

export function registerPreviewFrameProtocol(rendererRoot: string): void {
  protocol.handle(PREVIEW_FRAME_SCHEME, (request) => {
    const resolvedPath = previewFrameAssetPath(request.url, rendererRoot);
    if (resolvedPath === null) {
      return new Response('Not found', { status: 404 });
    }

    return net.fetch(pathToFileURL(resolvedPath).toString());
  });
}
