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
  const url = match?.[0]?.replace(/[.,;:!?)]+$/, '');
  if (!url) {
    return null;
  }
  return { href: url, text: url, length: url.length };
}

/** Replace autolinks with markers, leaving code spans and link destinations untouched. */
export function protectAutolinks(raw: string): ProtectedAutolinks {
  const links: Autolink[] = [];
  let text = '';
  let index = 0;
  let inCode = false;
  while (index < raw.length) {
    if (raw[index] === '`') {
      inCode = !inCode;
      text += '`';
      index += 1;
      continue;
    }
    const found = inCode ? null : (readAngleAutolink(raw, index) ?? readBareAutolink(raw, index));
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
