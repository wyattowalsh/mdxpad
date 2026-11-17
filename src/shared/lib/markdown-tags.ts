const HTML_TAGS = new Set([
  'a',
  'abbr',
  'article',
  'aside',
  'b',
  'blockquote',
  'button',
  'caption',
  'code',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'i',
  'kbd',
  'li',
  'main',
  'mark',
  'nav',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

interface AngleTag {
  readonly end: number;
  readonly name: string;
  readonly selfClosing: boolean;
  readonly closing: boolean;
  readonly fragment: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isNameStart(char: string): boolean {
  return char === '$' || char === '_' || /\p{L}/u.test(char);
}

function readSimpleAngle(value: string, open: number, next: string): AngleTag | null {
  if (next === '/') {
    const end = value.indexOf('>', open + 2);
    if (end === -1) {
      return null;
    }
    return { end: end + 1, name: '', selfClosing: false, closing: true, fragment: false };
  }
  if (next === '>') {
    return { end: open + 2, name: '', selfClosing: false, closing: false, fragment: true };
  }
  return null;
}

function scanNamedTag(value: string, open: number): AngleTag | null {
  let depth = 0;
  let quote: string | null = null;
  let name = '';
  let readingName = true;
  for (let index = open; index < value.length; index += 1) {
    const char = value[index] ?? '';
    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if ((char === '"' || char === "'") && depth >= 1) {
      quote = char;
      continue;
    }
    if (char === '<') {
      depth += 1;
      if (depth > 1) {
        readingName = false;
      }
      continue;
    }
    if (char === '>') {
      depth -= 1;
      if (depth === 0) {
        return {
          end: index + 1,
          name,
          selfClosing: value[index - 1] === '/',
          closing: false,
          fragment: false,
        };
      }
      continue;
    }
    if (readingName && depth === 1 && /[\w.:$-]/u.test(char)) {
      name += char;
    } else if (depth === 1) {
      readingName = false;
    }
  }
  return null;
}

function readAngleTag(value: string, open: number): AngleTag | null {
  const next = value[open + 1] ?? '';
  if (next === '/' || next === '>' || !isNameStart(next)) {
    return readSimpleAngle(value, open, next);
  }
  return scanNamedTag(value, open);
}

function escapeAngles(raw: string): string {
  return raw.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function keepTag(tag: AngleTag, prose: string): boolean {
  if (tag.closing || tag.selfClosing) {
    return true;
  }
  if (tag.fragment) {
    return prose.includes('</>');
  }
  return (
    HTML_TAGS.has(tag.name.toLowerCase()) ||
    new RegExp(`</${escapeRegExp(tag.name)}\\s*>`).test(prose)
  );
}

/** Escape `<...>` that is prose, including nested types, and leave real tags in place. */
export function escapeLooseTags(value: string, prose: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    if (value[index] !== '<') {
      result += value[index] ?? '';
      index += 1;
      continue;
    }
    const tag = readAngleTag(value, index);
    if (!tag) {
      result += '&lt;';
      index += 1;
      continue;
    }
    const raw = value.slice(index, tag.end);
    result += keepTag(tag, prose) ? raw : escapeAngles(raw);
    index = tag.end;
  }
  return result;
}
