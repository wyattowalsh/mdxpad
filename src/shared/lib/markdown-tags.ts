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

const UNCLOSED_HTML = new Set([
  'article',
  'aside',
  'blockquote',
  'button',
  'caption',
  'dd',
  'details',
  'div',
  'dl',
  'dt',
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
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'span',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

function hasCloser(name: string, prose: string): boolean {
  return new RegExp(`</${escapeRegExp(name)}\\s*>`).test(prose);
}

function keepTag(tag: AngleTag, prose: string): boolean {
  if (tag.closing || tag.selfClosing) {
    return true;
  }
  if (tag.fragment) {
    return prose.includes('</>');
  }
  if (hasCloser(tag.name, prose)) {
    return true;
  }
  return UNCLOSED_HTML.has(tag.name.toLowerCase());
}

const TEMPLATE_PLACEHOLDER = /^\{\{\s*\w+\s*\}\}/;

/** Show `{{name}}` as text outside tags so a template placeholder does not run as an object. */
export function escapeTemplatePlaceholders(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    if (value[index] === '<') {
      const tag = readAngleTag(value, index);
      if (tag) {
        result += value.slice(index, tag.end);
        index = tag.end;
        continue;
      }
    }
    if (value.startsWith('{{', index)) {
      const placeholder = TEMPLATE_PLACEHOLDER.exec(value.slice(index));
      if (placeholder) {
        result += placeholder[0].replaceAll('{', '\\{').replaceAll('}', '\\}');
        index += placeholder[0].length;
        continue;
      }
    }
    result += value[index] ?? '';
    index += 1;
  }
  return result;
}

function hrefForEncodedUrl(url: string): string {
  return url.replaceAll('&lt;', '%3C').replaceAll('&gt;', '%3E').replaceAll('&amp;', '%26');
}

function splitTrailingPunctuation(url: string): { url: string; suffix: string } {
  let end = url.length;
  while (end > 0 && /[.,:;!?]/.test(url[end - 1] ?? '')) {
    if (/(?:&lt|&gt|&amp)$/.test(url.slice(0, end - 1))) {
      break;
    }
    end -= 1;
  }
  return { url: url.slice(0, end), suffix: url.slice(end) };
}

/** Keep a URL readable after an angle bracket inside it was escaped. */
export function linkUrlsWithEscapedAngles(value: string): string {
  return value.replace(/https?:\/\/[^\s)]+/gi, (url, offset) => {
    if (!url.includes('&lt;') && !url.includes('&gt;')) {
      return url;
    }
    const previous = value[offset - 1];
    if (previous === '(' || previous === '[') {
      return url;
    }
    const trimmed = splitTrailingPunctuation(url);
    return `[${trimmed.url}](${hrefForEncodedUrl(trimmed.url)})${trimmed.suffix}`;
  });
}

/** A link address written as `](<...>)`, which must stay an address. */
export function angleDestinationEnd(value: string, index: number): number {
  if (value[index] !== '<' || value[index - 1] !== '(' || value[index - 2] !== ']') {
    return -1;
  }
  const end = value.indexOf('>', index + 1);
  if (end === -1) {
    return -1;
  }
  const body = value.slice(index + 1, end);
  if (body.length === 0 || body.includes('\n') || body.includes('<')) {
    return -1;
  }
  return end + 1;
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
    const destination = angleDestinationEnd(value, index);
    if (destination !== -1) {
      result += value.slice(index, destination);
      index = destination;
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
