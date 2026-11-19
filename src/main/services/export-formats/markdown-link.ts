import { codeSpanEnd } from '@shared/lib/emphasis-flank';

function unwrapDestination(raw: string): string | null {
  const angled = /^(?:<|&lt;)(.+?)(?:>|&gt;)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?$/.exec(raw);
  return angled?.[1] ?? null;
}

function readTitle(raw: string): { title: string; end: number } | null {
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
      return { title, end: index + 1 };
    }
    title += char;
  }
  return null;
}

function readWrappedTitle(raw: string): { title: string; end: number } | null {
  const title = readTitle(raw);
  if (!title || raw.slice(title.end).trim().length > 0) {
    return null;
  }
  return title;
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

function readBareDestination(raw: string): number {
  let depth = 0;
  let index = 0;
  while (index < raw.length) {
    const char = raw[index] ?? '';
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '(') {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === ')' && depth === 0) {
      return index;
    }
    if (char === ')') {
      depth -= 1;
      index += 1;
      continue;
    }
    if (depth === 0 && (char === ' ' || char === '\n' || char === '\r')) {
      return index;
    }
    index += 1;
  }
  return -1;
}

function rawAngleEnd(raw: string): number {
  for (let index = 1; index < raw.length; index += 1) {
    const char = raw[index] ?? '';
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === '\n' || char === '\r' || char === '<') {
      return -1;
    }
    if (char === '>') {
      return index + 1;
    }
  }
  return -1;
}

function angledDestinationEnd(raw: string): number {
  if (raw.startsWith('<')) {
    return rawAngleEnd(raw);
  }
  if (raw.startsWith('&lt;')) {
    const close = raw.indexOf('&gt;');
    return close === -1 ? -1 : close + 4;
  }
  return -1;
}

function skipLinkSpace(raw: string, index: number): number {
  let cursor = index;
  while (/[ \t\n\r]/.test(raw[cursor] ?? '')) {
    cursor += 1;
  }
  return cursor;
}

function readLinkInside(raw: string): { text: string; end: number } | null {
  const start = skipLinkSpace(raw, 0);
  const head = raw.slice(start);
  const angled = angledDestinationEnd(head);
  if (angled === -1 && (head.startsWith('<') || head.startsWith('&lt;'))) {
    return null;
  }
  let cursor = start;
  if (angled > 0) {
    cursor = start + angled;
  } else {
    const end = readBareDestination(head);
    if (end === -1) {
      return null;
    }
    cursor = start + end;
  }
  if (/\s/.test(raw[cursor] ?? '')) {
    let index = cursor;
    while (/\s/.test(raw[index] ?? '')) {
      index += 1;
    }
    const title = readTitle(raw.slice(index));
    if (title) {
      cursor = index + title.end;
    }
  }
  while (/\s/.test(raw[cursor] ?? '')) {
    cursor += 1;
  }
  if (raw[cursor] !== ')') {
    return null;
  }
  return { text: raw.slice(0, cursor), end: cursor + 1 };
}

function readBalancedLabel(
  raw: string,
  openIndex: number
): { readonly text: string; readonly end: number } | null {
  let depth = 0;
  let text = '';
  for (let index = openIndex; index < raw.length; index += 1) {
    const char = raw[index] ?? '';
    if (char === '\\' && depth > 0) {
      text += `${char}${raw[index + 1] ?? ''}`;
      index += 1;
      continue;
    }
    if (char === '`' && depth > 0) {
      const end = codeSpanEnd(raw, index);
      if (end > index) {
        text += raw.slice(index, end);
        index = end - 1;
        continue;
      }
    }
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

function labelHoldsLink(label: string): boolean {
  let index = 0;
  while (index < label.length) {
    const nested = findMarkdownTarget(label, index);
    if (!nested) {
      return false;
    }
    if (!nested.image) {
      return true;
    }
    index = nested.end;
  }
  return false;
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
  const inside = readLinkInside(raw.slice(label.end + 1));
  if (!inside) {
    return null;
  }
  if (labelHoldsLink(label.text)) {
    return null;
  }
  return {
    image,
    label: label.text,
    destination: inside.text,
    start,
    end: label.end + 1 + inside.end,
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

const URL_CHAR = /[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=]/;

function encodeDestination(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? '';
    const encoded = value.slice(index + 1, index + 3);
    if (char === '%' && /^[0-9A-Fa-f]{2}$/.test(encoded)) {
      result += `%${encoded}`;
      index += 2;
      continue;
    }
    result += URL_CHAR.test(char) ? char : encodeURIComponent(char);
  }
  return result;
}

/** Keep the link or image address and drop an optional Markdown title. */
export function linkDestination(raw: string): string {
  const decoded = raw.trim().replaceAll('&quot;', '"').replaceAll('&#39;', "'");
  const angled = unwrapDestination(decoded);
  if (angled !== null) {
    return encodeDestination(unescapeDestination(angled));
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
