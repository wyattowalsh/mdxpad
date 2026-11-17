import { readCodeSpan } from './markdown-escape';

const AUTOLINK_MARK = '\uE010';

export interface Autolink {
  readonly href: string;
  readonly text: string;
}

export interface ProtectedAutolinks {
  readonly text: string;
  readonly links: readonly Autolink[];
}

interface FoundAutolink extends Autolink {
  readonly length: number;
}

function readAngleAutolink(raw: string, index: number): FoundAutolink | null {
  if (raw[index] !== '<' || raw[index - 1] === '(') {
    return null;
  }
  const end = raw.indexOf('>', index + 1);
  if (end === -1) {
    return null;
  }
  const body = raw.slice(index + 1, end);
  if (/^https?:\/\/\S+$/i.test(body)) {
    return { href: body, text: body, length: end - index + 1 };
  }
  if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(body)) {
    return { href: `mailto:${body}`, text: body, length: end - index + 1 };
  }
  return null;
}

function readBareAutolink(raw: string, index: number): FoundAutolink | null {
  if (!raw.startsWith('http://', index) && !raw.startsWith('https://', index)) {
    return null;
  }
  const previous = index === 0 ? '' : (raw[index - 1] ?? '');
  if (previous !== '' && !/\s/.test(previous)) {
    return null;
  }
  const match = /^https?:\/\/[^\s<]+/i.exec(raw.slice(index));
  const url = match?.[0] === undefined ? '' : trimAutolinkTrail(match[0]);
  if (!url) {
    return null;
  }
  return { href: url, text: url, length: url.length };
}

function boundaryAllowsWww(previous: string): boolean {
  return previous.length === 0 || /[\s(*_[\]~]/.test(previous);
}

function readWwwAutolink(raw: string, index: number): FoundAutolink | null {
  const previous = index === 0 ? '' : (raw[index - 1] ?? '');
  if (!boundaryAllowsWww(previous)) {
    return null;
  }
  const match = /^www\.[^\s<]+/i.exec(raw.slice(index));
  const url = match?.[0] === undefined ? '' : trimAutolinkTrail(match[0]);
  const host = url.slice(4).split(/[/?#]/)[0] ?? '';
  if (!/^www\.\S/i.test(url) || !/[A-Za-z0-9]/.test(host)) {
    return null;
  }
  return { href: `http://${url}`, text: url, length: url.length };
}

function readEmailAutolink(raw: string, index: number): FoundAutolink | null {
  const previous = index === 0 ? '' : (raw[index - 1] ?? '');
  if (previous === '/' || /[A-Za-z0-9+._-]/.test(previous)) {
    return null;
  }
  const match =
    /^[A-Za-z0-9+._-]+@[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?)+/.exec(
      raw.slice(index)
    );
  const email = match?.[0] ?? '';
  if (email.length === 0) {
    return null;
  }
  return { href: `mailto:${email}`, text: email, length: email.length };
}

function trimAutolinkTrail(value: string): string {
  let url = value;
  while (url.length > 0) {
    const trimmed = url.replace(/[.,;:!?_*~'"]+$/, '');
    const open = trimmed.split('(').length - 1;
    const close = trimmed.split(')').length - 1;
    if (close > open && trimmed.endsWith(')')) {
      url = trimmed.slice(0, -1);
      continue;
    }
    if (trimmed.length === url.length) {
      return trimmed;
    }
    url = trimmed;
  }
  return url;
}

function linkDestinationEnd(raw: string, index: number): number | null {
  if (raw[index] !== ']' || raw[index + 1] !== '(') {
    return null;
  }
  let depth = 0;
  for (let cursor = index + 1; cursor < raw.length; cursor += 1) {
    const char = raw[cursor];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return cursor + 1;
      }
    }
  }
  return null;
}

/** Replace autolinks with markers, leaving code spans and link destinations untouched. */
export function protectAutolinks(raw: string): ProtectedAutolinks {
  const links: Autolink[] = [];
  let text = '';
  let index = 0;
  while (index < raw.length) {
    if (raw[index] === '`') {
      const span = readCodeSpan(raw, index);
      text += span ? raw.slice(index, span.end) : '`';
      index = span ? span.end : index + 1;
      continue;
    }
    const destinationEnd = linkDestinationEnd(raw, index);
    if (destinationEnd !== null) {
      text += raw.slice(index, destinationEnd);
      index = destinationEnd;
      continue;
    }
    const found =
      readAngleAutolink(raw, index) ??
      readBareAutolink(raw, index) ??
      readWwwAutolink(raw, index) ??
      readEmailAutolink(raw, index);
    if (found) {
      text += `${AUTOLINK_MARK}${links.length}${AUTOLINK_MARK}`;
      links.push({ href: found.href, text: found.text });
      index += found.length;
      continue;
    }
    text += raw.charAt(index);
    index += 1;
  }
  return { text, links };
}

/** Replace autolink markers. A marker already inside an anchor stays text. */
export function replaceAutolinks(
  html: string,
  links: readonly Autolink[],
  render: (link: Autolink, nested: boolean) => string
): string {
  const pattern = new RegExp(`${AUTOLINK_MARK}(\\d+)${AUTOLINK_MARK}|</a>|<a\\b`, 'g');
  let result = '';
  let last = 0;
  let depth = 0;
  for (const match of html.matchAll(pattern)) {
    const start = match.index;
    result += html.slice(last, start);
    if (match[0] === '</a>') {
      depth = Math.max(0, depth - 1);
      result += match[0];
    } else if (match[0] === '<a') {
      depth += 1;
      result += match[0];
    } else {
      const link = links[Number(match[1])];
      result += link ? render(link, depth > 0) : match[0];
    }
    last = start + match[0].length;
  }
  return result + html.slice(last);
}

export function expandAutolinkText(
  text: string,
  links: readonly Autolink[]
): readonly { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  const pattern = new RegExp(`${AUTOLINK_MARK}(\\d+)${AUTOLINK_MARK}`, 'g');
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > last) {
      parts.push({ text: text.slice(last, start) });
    }
    const link = links[Number(match[1])];
    if (link) {
      parts.push({ text: link.text, href: link.href });
    }
    last = start + match[0].length;
  }
  if (last < text.length || parts.length === 0) {
    parts.push({ text: text.slice(last) });
  }
  return parts;
}
