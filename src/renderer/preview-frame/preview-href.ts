import { decodeHTMLStrict } from 'entities';

function withoutHiddenBreaks(value: string): string {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code !== 0 && code !== 9 && code !== 10 && code !== 13) {
      result += char;
    }
  }
  return result.trim();
}

function decodedHref(value: string): string {
  let current = withoutHiddenBreaks(decodeHTMLStrict(value));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = withoutHiddenBreaks(decodeURIComponent(current));
      if (next === current) {
        return current;
      }
      current = next;
    } catch {
      return current;
    }
  }
  return current;
}

function addressScheme(value: string): string | null {
  const separator = value.indexOf(':');
  if (separator <= 0) {
    return null;
  }
  const scheme = value.slice(0, separator).toLowerCase();
  return /^[a-z][a-z0-9+.-]*$/.test(scheme) ? scheme : null;
}

function isDocumentPath(value: string): boolean {
  const pathPart = value.split('#')[0]?.split('?')[0] ?? '';
  return /\.(md|mdx|markdown|txt)$/i.test(pathPart);
}

/** A preview link that must not navigate or open a local file. */
export function isBlockedPreviewHref(href: string | undefined): boolean {
  if (!href) {
    return false;
  }
  const normalized = decodedHref(href);
  if (normalized.startsWith('/') || normalized.startsWith('\\')) {
    return !isDocumentPath(normalized);
  }
  const scheme = addressScheme(normalized);
  if (scheme === null) {
    return false;
  }
  return scheme !== 'http' && scheme !== 'https' && scheme !== 'mailto';
}
