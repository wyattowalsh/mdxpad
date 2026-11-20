import { readAngleTag } from './markdown-tags';

const SIMPLE_TAG = /<(em|i|strong|b|code|del|s|strike|sub|sup|a)(\s[^<>]*)?>([^<>]*)<\/\1>/gi;
const HEADING_TAG = /<h([1-6])\b[^<>]*>([^<>]*)<\/h\1>/gi;

const SUBSCRIPT: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  a: 'ₐ',
  e: 'ₑ',
  h: 'ₕ',
  i: 'ᵢ',
  j: 'ⱼ',
  k: 'ₖ',
  l: 'ₗ',
  m: 'ₘ',
  n: 'ₙ',
  o: 'ₒ',
  p: 'ₚ',
  r: 'ᵣ',
  s: 'ₛ',
  t: 'ₜ',
  u: 'ᵤ',
  v: 'ᵥ',
  x: 'ₓ',
};

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ',
};

function mappedScript(inner: string, table: Record<string, string>): string | null {
  let result = '';
  for (const char of inner) {
    const mapped = table[char];
    if (mapped === undefined) {
      return null;
    }
    result += mapped;
  }
  return result.length > 0 ? result : null;
}

function markdownHref(attrs: string): string | null {
  const match = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(attrs);
  const href = match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
  if (href.length === 0 || /^(?:javascript|data|file):/i.test(href)) {
    return null;
  }
  return href;
}

function linkedImages(inner: string): boolean {
  const trimmed = inner.trim();
  return trimmed.length > 0 && /^(?:!\[[^\]\n]*\]\([^)\n]+\)\s*)+$/.test(trimmed);
}

function linkLabel(inner: string): string | null {
  const label = inner.replace(/\s+/g, ' ').trim();
  if (label.length === 0 || label.includes('[') || label.includes(']')) {
    return null;
  }
  return label;
}

function stampSuffix(attrs: string): string {
  const datetime = attrValue(attrs, 'datetime')?.trim() ?? '';
  const cite = attrValue(attrs, 'cite')?.trim() ?? '';
  const stamp = datetime.length > 0 ? datetime : cite;
  if (stamp.length === 0 || /^(?:javascript|data|file):/i.test(stamp)) {
    return '';
  }
  return ` (${stamp})`;
}

function struckPhrase(inner: string, suffix: string): string {
  if (inner.length === 0) {
    return suffix.trim();
  }
  return `~~${inner}~~${suffix}`;
}

function promotedTag(name: string, attrs: string, inner: string): string | null {
  switch (name.toLowerCase()) {
    case 'em':
    case 'i':
      return `*${inner}*`;
    case 'strong':
    case 'b':
      return `**${inner}**`;
    case 'del':
    case 's':
    case 'strike':
      return struckPhrase(inner, name.toLowerCase() === 'del' ? stampSuffix(attrs) : '');
    case 'code':
      return inner.includes('`') ? null : `\`${inner}\``;
    case 'sub':
      return mappedScript(inner, SUBSCRIPT);
    case 'sup':
      return mappedScript(inner, SUPERSCRIPT);
    case 'a': {
      const href = markdownHref(attrs);
      const title = attrValue(attrs, 'title')?.trim() ?? '';
      if (linkedImages(inner) && href !== null) {
        return `[${inner.trim()}](${href})`;
      }
      const label = linkLabel(inner) ?? (title.length > 0 ? title : null);
      if (href === null) {
        return label ?? inner;
      }
      if (label === null) {
        return null;
      }
      const shownTitle = title.length > 0 && title !== label ? markdownImageTitle(title) : '';
      return `[${label}](${href}${shownTitle})`;
    }
    default:
      return null;
  }
}

function attrValue(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, 'i').exec(
    attrs
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function markdownImageAlt(alt: string): string {
  return alt.replace(/[\\[\]]/g, (char) => `\\${char}`);
}

function markdownImageDestination(src: string): string {
  if (!/[\s<>()]/.test(src)) {
    return src;
  }
  const angled = src.replaceAll('\\', '\\\\').replaceAll('<', '%3C').replaceAll('>', '%3E');
  return `<${angled}>`;
}

function markdownImageTitle(title: string | null): string {
  if (title === null || title.length === 0 || /[\r\n]/.test(title)) {
    return '';
  }
  return ` "${title.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function usableImageAddress(destination: string | null): destination is string {
  return (
    destination !== null &&
    destination.length > 0 &&
    !/^(?:javascript|data|file):/i.test(destination)
  );
}

function climbsOut(address: string): boolean {
  return address
    .replaceAll('\\', '/')
    .split('/')
    .some((part) => part === '..');
}

function listAddress(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  for (const part of value.split(',')) {
    const url = part.trim().split(/\s+/)[0] ?? '';
    if (!usableImageAddress(url) || climbsOut(url) || url.startsWith('/') || url.startsWith('\\')) {
      continue;
    }
    return url;
  }
  return null;
}

function promotedImage(attrs: string, match: string): string {
  const src = attrValue(attrs, 'src');
  const address = usableImageAddress(src)
    ? src
    : (listAddress(attrValue(attrs, 'srcset')) ?? listAddress(attrValue(attrs, 'imagesrcset')));
  if (address === null) {
    return match;
  }
  const alt = markdownImageAlt(attrValue(attrs, 'alt') ?? '');
  const described = imageDescription(attrs);
  const title = markdownImageTitle(attrValue(attrs, 'title'));
  const image = `![${alt}](${markdownImageDestination(address)}${title})`;
  return described.length > 0 && !alt.includes(described) ? `${image}\n\n${described}` : image;
}

function imageDescription(attrs: string): string {
  const text = (attrValue(attrs, 'longdesc') ?? '').trim();
  if (text.length === 0 || text.includes(':') || /^[./\\]/.test(text)) {
    return '';
  }
  return markdownImageAlt(text);
}

function promotedVoid(name: 'hr' | 'img', attrs: string, match: string): string {
  switch (name) {
    case 'hr':
      return '\n\n***\n\n';
    case 'img':
      return promotedImage(attrs, match);
    default: {
      const unexpected: never = name;
      return unexpected;
    }
  }
}

function voidKind(name: string): 'hr' | 'img' | null {
  return name === 'hr' || name === 'img' ? name : null;
}

function promoteVoids(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    const start = value.indexOf('<', index);
    if (start === -1) {
      return result + value.slice(index);
    }
    result += value.slice(index, start);
    const tag = readAngleTag(value, start);
    const kind = tag ? voidKind(tag.name.toLowerCase()) : null;
    if (!tag || kind === null) {
      result += '<';
      index = start + 1;
      continue;
    }
    const raw = value.slice(start, tag.end);
    const attrs = raw.replace(/^<[\w:-]+\b/u, '').replace(/\/?>$/, '');
    result += promotedVoid(kind, attrs, raw);
    index = tag.end;
  }
  return result;
}

function promoteHeadings(value: string): string {
  return value.replace(HEADING_TAG, (_match, level: string, inner: string) => {
    const depth = Number(level);
    return `\n\n${'#'.repeat(depth)} ${inner.trim()}\n\n`;
  });
}

/** Turn simple inline HTML into markdown so every export can format it. */
export function promoteInlineHtml(value: string): string {
  let current = promoteVoids(value);
  for (let pass = 0; pass < 4; pass += 1) {
    const next = current.replace(
      SIMPLE_TAG,
      (match, name: string, attrs: string | undefined, inner: string) => {
        return promotedTag(name, attrs ?? '', inner) ?? match;
      }
    );
    if (next === current) {
      break;
    }
    current = next;
  }
  return promoteHeadings(current);
}
