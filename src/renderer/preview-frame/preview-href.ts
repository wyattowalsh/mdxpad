function withoutHiddenBreaks(value: string): string {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code !== 0 && code !== 9 && code !== 10 && code !== 13) {
      result += char;
    }
  }
  return result;
}

/** A preview link that must not navigate or open a local file. */
export function isBlockedPreviewHref(href: string | undefined): boolean {
  if (!href) {
    return false;
  }
  const normalized = withoutHiddenBreaks(href).trim();
  const separator = normalized.indexOf(':');
  if (separator <= 0) {
    return false;
  }
  const scheme = normalized.slice(0, separator).toLowerCase();
  return scheme === 'file' || scheme === 'javascript';
}
