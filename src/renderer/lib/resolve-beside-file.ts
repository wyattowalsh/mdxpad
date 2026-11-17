/**
 * Join a relative path onto a directory without Node path builtins.
 * The renderer bundle does not provide node:path or node:url.
 */

function isAbsolutePath(value: string): boolean {
  return value.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(value);
}

export function joinRelativePath(directory: string, relativePath: string): string | null {
  if (relativePath.length === 0 || relativePath.includes('\0') || isAbsolutePath(relativePath)) {
    return null;
  }

  const absolute = directory.startsWith('/');
  const parts = directory.split('/').filter((part) => part.length > 0);
  for (const part of relativePath.split(/[/\\]/)) {
    if (part.length === 0 || part === '.') {
      continue;
    }
    if (part === '..') {
      if (parts.length === 0) {
        return null;
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  const joined = parts.join('/');
  return absolute ? `/${joined}` : joined;
}

/** Keep a relative link inside the open file's directory. */
export function resolveInsideDirectory(directory: string, relativePath: string): string | null {
  const resolved = joinRelativePath(directory, relativePath);
  if (resolved === null) {
    return null;
  }
  const prefix = directory.endsWith('/') ? directory : `${directory}/`;
  if (resolved === directory || resolved.startsWith(prefix)) {
    return resolved;
  }
  return null;
}
