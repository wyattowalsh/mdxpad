/**
 * The inside of a Markdown link or image target.
 * A quoted title may contain `)`, which must not end the target.
 */
export const MARKDOWN_LINK_INSIDE =
  '(?:[^()"\']|"(?:\\\\.|[^"])*"|\'(?:\\\\.|[^\'])*\'|\\([^()]*\\))*';

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

export interface MarkdownTarget {
  readonly image: boolean;
  readonly label: string;
  readonly destination: string;
  readonly start: number;
  readonly end: number;
}

function readBalancedLabel(
  raw: string,
  openIndex: number
): { readonly text: string; readonly end: number } | null {
  let depth = 0;
  let text = '';
  for (let index = openIndex; index < raw.length; index += 1) {
    const char = raw[index] ?? '';
    if (char === '[') {
      if (depth > 0) {
        text += char;
      }
      depth += 1;
      continue;
    }
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return { text, end: index + 1 };
      }
      text += char;
      continue;
    }
    if (depth > 0) {
      text += char;
    }
  }
  return null;
}

/** A link or image, including a label that itself contains brackets. */
export function readMarkdownTarget(raw: string, start: number): MarkdownTarget | null {
  const image = raw[start] === '!' && raw[start + 1] === '[';
  const bracket = image ? start + 1 : start;
  if (raw[bracket] !== '[') {
    return null;
  }
  const label = readBalancedLabel(raw, bracket);
  if (!label || raw[label.end] !== '(') {
    return null;
  }
  const destination = new RegExp(`^(${MARKDOWN_LINK_INSIDE})\\)`).exec(raw.slice(label.end + 1));
  if (!destination) {
    return null;
  }
  return {
    image,
    label: label.text,
    destination: destination[1] ?? '',
    start,
    end: label.end + 1 + destination[0].length,
  };
}

/** The next link or image at or after `from`. */
export function findMarkdownTarget(raw: string, from: number): MarkdownTarget | null {
  for (let index = from; index < raw.length; index += 1) {
    const start = raw[index] === '!' && raw[index + 1] === '[' ? index : -1;
    const parsed = readMarkdownTarget(raw, start === -1 ? index : start);
    if (parsed && (start !== -1 || raw[index] === '[')) {
      return parsed;
    }
  }
  return null;
}

const DESTINATION_ESCAPE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

function unescapeDestination(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const next = value[index + 1] ?? '';
    if (value[index] === '\\' && DESTINATION_ESCAPE.test(next)) {
      result += next;
      index += 1;
      continue;
    }
    result += value[index] ?? '';
  }
  return result;
}

function encodeDestination(value: string): string {
  try {
    return encodeURI(value);
  } catch {
    return value;
  }
}

/** Keep the link or image address and drop an optional Markdown title. */
export function linkDestination(raw: string): string {
  const decoded = raw.trim().replaceAll('&quot;', '"').replaceAll('&#39;', "'");
  const angled = unwrapDestination(decoded);
  if (angled !== null) {
    return encodeDestination(angled);
  }
  return encodeDestination(unescapeDestination(stripTitle(decoded) ?? decoded));
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
