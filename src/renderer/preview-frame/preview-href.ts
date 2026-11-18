/** A preview link that must not navigate or open a local file. */
export function isBlockedPreviewHref(href: string | undefined): boolean {
  if (!href) {
    return false;
  }
  const trimmed = href.trim();
  const separator = trimmed.indexOf(':');
  if (separator <= 0) {
    return false;
  }
  const scheme = trimmed.slice(0, separator).toLowerCase();
  return scheme === 'file' || scheme === 'javascript';
}
