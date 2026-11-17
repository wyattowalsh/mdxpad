function unwrapDestination(raw: string): string | null {
  const angled = /^(?:<|&lt;)(.+?)(?:>|&gt;)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?$/.exec(raw);
  return angled?.[1] ?? null;
}

function stripTitle(raw: string): string | null {
  const titled = /^(\S+)\s+(?:"[^"]*"|'[^']*'|\([^)]*\))$/.exec(raw);
  return titled?.[1] ?? null;
}

/** Keep the link or image address and drop an optional Markdown title. */
export function linkDestination(raw: string): string {
  const decoded = raw.trim().replaceAll('&quot;', '"').replaceAll('&#39;', "'");
  return unwrapDestination(decoded) ?? stripTitle(decoded) ?? decoded;
}
