/**
 * Skip an HTML tag while a table cell is split, so a pipe in the tag
 * stays inside the cell.
 */

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'wbr',
]);

interface HtmlTag {
  readonly name: string;
  readonly end: number;
  readonly closing: boolean;
  readonly selfClosing: boolean;
}

function readHtmlTag(value: string, index: number): HtmlTag | null {
  if (value[index] !== '<') {
    return null;
  }
  const closing = value[index + 1] === '/';
  let cursor = index + (closing ? 2 : 1);
  let name = '';
  while (/[A-Za-z0-9-]/.test(value[cursor] ?? '')) {
    name += value[cursor] ?? '';
    cursor += 1;
  }
  if (!/^[A-Za-z]/.test(name)) {
    return null;
  }
  let quote = '';
  for (; cursor < value.length; cursor += 1) {
    const char = value[cursor] ?? '';
    if (quote.length > 0) {
      if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') {
      return {
        name: name.toLowerCase(),
        end: cursor + 1,
        closing,
        selfClosing: value[cursor - 1] === '/',
      };
    }
  }
  return null;
}

function matchingClose(value: string, tag: HtmlTag): number {
  let depth = 1;
  let cursor = tag.end;
  while (cursor < value.length && depth > 0) {
    if (value[cursor] !== '<') {
      cursor += 1;
      continue;
    }
    const next = readHtmlTag(value, cursor);
    if (!next) {
      cursor += 1;
      continue;
    }
    if (next.name === tag.name) {
      depth += next.closing ? -1 : 1;
    }
    cursor = next.end;
  }
  return depth === 0 ? cursor : tag.end;
}

/** End index after an HTML tag or element that starts at `index`. */
export function skipHtmlElement(value: string, index: number): number {
  if (value.startsWith('<!--', index)) {
    const end = value.indexOf('-->', index + 4);
    return end === -1 ? index : end + 3;
  }
  const tag = readHtmlTag(value, index);
  if (!tag || tag.closing) {
    return index;
  }
  if (tag.selfClosing || VOID_TAGS.has(tag.name)) {
    return tag.end;
  }
  return matchingClose(value, tag);
}
