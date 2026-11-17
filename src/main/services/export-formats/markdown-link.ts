/**
 * The inside of a Markdown link or image target.
 * A quoted title may contain `)`, which must not end the target.
 */
export const MARKDOWN_LINK_INSIDE =
  '(?:[^()"\']|"(?:\\\\.|[^"])*"|\'(?:\\\\.|[^\'])*\'|\\([^()]*\\))+';

function unwrapDestination(raw: string): string | null {
  const angled = /^(?:<|&lt;)(.+?)(?:>|&gt;)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?$/.exec(raw);
  return angled?.[1] ?? null;
}

function readWrappedTitle(raw: string): { title: string; end: number } | null {
  const quote = raw[0];
  const closer = quote === '(' ? ')' : quote;
  if (quote !== '"' && quote !== "'" && quote !== '(') {
    return null;
  }
  let title = '';
  for (let index = 1; index < raw.length; index += 1) {
    const char = raw[index] ?? '';
    if (char === '\\' && index + 1 < raw.length) {
      title += raw[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (char === closer) {
      return raw.slice(index + 1).trim().length === 0 ? { title, end: index + 1 } : null;
    }
    title += char;
  }
  return null;
}

function titleAt(raw: string): { title: string; start: number } | null {
  const spaced = raw.search(/\s/);
  if (spaced === -1) {
    return null;
  }
  const start = raw.slice(spaced).search(/\S/);
  if (start === -1) {
    return null;
  }
  const index = spaced + start;
  const wrapped = readWrappedTitle(raw.slice(index));
  return wrapped ? { title: wrapped.title, start: index } : null;
}

function stripTitle(raw: string): string | null {
  const title = titleAt(raw);
  return title ? raw.slice(0, title.start).trim() : null;
}

/** Keep the link or image address and drop an optional Markdown title. */
export function linkDestination(raw: string): string {
  const decoded = raw.trim().replaceAll('&quot;', '"').replaceAll('&#39;', "'");
  return unwrapDestination(decoded) ?? stripTitle(decoded) ?? decoded;
}

/** Read a Markdown title that follows a link or image address. */
export function linkTitle(raw: string): string | null {
  const decoded = raw.trim().replaceAll('&quot;', '"').replaceAll('&#39;', "'");
  const angled = /^(?:<|&lt;).+?(?:>|&gt;)\s+([\s\S]+)$/.exec(decoded);
  const candidate = angled?.[1] ?? decoded;
  const bare = angled ? readWrappedTitle(candidate.trim()) : null;
  const title = bare?.title ?? titleAt(candidate)?.title ?? '';
  return title.length > 0 ? title : null;
}
