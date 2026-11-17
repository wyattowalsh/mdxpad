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

const TITLE = /^(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/;

/** Read a Markdown title that follows a link or image address. */
export function linkTitle(raw: string): string | null {
  const decoded = raw.trim().replaceAll('&quot;', '"').replaceAll('&#39;', "'");
  const angled = /^(?:<|&lt;).+?(?:>|&gt;)\s+([\s\S]+)$/.exec(decoded);
  const plain = angled ? null : /^\S+\s+([\s\S]+)$/.exec(decoded);
  const candidate = angled?.[1] ?? plain?.[1] ?? '';
  const match = TITLE.exec(candidate);
  const title = match?.[1] ?? match?.[2] ?? match?.[3];
  return title && title.length > 0 ? title : null;
}
