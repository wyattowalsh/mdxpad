/**
 * Addresses that can appear in exported HTML.
 * A picture or link must not point at a local file.
 */

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

function decodedAddress(value: string): string {
  let current = withoutHiddenBreaks(value);
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
  const normalized = decodedAddress(value);
  const separator = normalized.indexOf(':');
  if (separator <= 0) {
    return null;
  }
  const scheme = normalized.slice(0, separator).toLowerCase();
  return /^[a-z][a-z0-9+.-]*$/.test(scheme) ? scheme : null;
}

/** An image address the exported page can request. */
export function safeImageAddress(destination: string): string | null {
  const scheme = addressScheme(destination);
  if (scheme === 'http' || scheme === 'https') {
    return destination;
  }
  if (scheme === 'data' && decodedAddress(destination).toLowerCase().startsWith('data:image/')) {
    return destination;
  }
  if (scheme !== null || destination.startsWith('/') || destination.startsWith('\\')) {
    return null;
  }
  return destination;
}

/** A link address the exported page can open. */
export function safeLinkAddress(destination: string): string | null {
  const scheme = addressScheme(destination);
  if (scheme === null || scheme === 'http' || scheme === 'https' || scheme === 'mailto') {
    return destination;
  }
  return null;
}

function quotedAttribute(tag: string, name: string): { value: string; pattern: RegExp } | null {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*("[^"]*"|'[^']*')`, 'i');
  const match = pattern.exec(tag);
  const quoted = match?.[1];
  if (!match || quoted === undefined) {
    return null;
  }
  return { value: quoted.slice(1, -1), pattern };
}

/** Drop an image or link address that would read a local file. */
export function sanitizeExportedTag(tag: string): string {
  const image = /^<\s*img\b/i.test(tag);
  const link = /^<\s*a\b/i.test(tag);
  if (!image && !link) {
    return tag;
  }
  const name = image ? 'src' : 'href';
  const found = quotedAttribute(tag, name);
  if (!found) {
    return tag;
  }
  const safe = image ? safeImageAddress(found.value) : safeLinkAddress(found.value);
  return safe === null ? tag.replace(found.pattern, '') : tag;
}
