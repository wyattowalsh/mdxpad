import { decodeHTMLStrict } from 'entities';

import { decodeCssEscapes, stripCssComments } from '@shared/lib/css-escape';

function withoutHiddenBreaks(value: string): string {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code !== 0 && code !== 9 && code !== 10 && code !== 13) {
      result += char;
    }
  }
  return result.trim();
}

function decodedHref(value: string): string {
  let current = withoutHiddenBreaks(decodeHTMLStrict(value));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = withoutHiddenBreaks(decodeURIComponent(current));
      if (next === current) {
        return current;
      }
      current = next;
    } catch {
      return current;
    }
  }
  return current;
}

function addressScheme(value: string): string | null {
  const separator = value.indexOf(':');
  if (separator <= 0) {
    return null;
  }
  const scheme = value.slice(0, separator).toLowerCase();
  return /^[a-z][a-z0-9+.-]*$/.test(scheme) ? scheme : null;
}

function isDocumentPath(value: string): boolean {
  const pathPart = value.split('#')[0]?.split('?')[0] ?? '';
  return /\.(md|mdx|markdown|txt)$/i.test(pathPart);
}

/** A preview link that must not navigate or open a local file. */
export function isBlockedPreviewHref(href: string | undefined): boolean {
  if (!href) {
    return false;
  }
  const normalized = decodedHref(href);
  if (normalized.startsWith('/') || normalized.startsWith('\\')) {
    return !isDocumentPath(normalized);
  }
  const scheme = addressScheme(normalized);
  if (scheme === null) {
    return false;
  }
  return scheme !== 'http' && scheme !== 'https' && scheme !== 'mailto';
}

/** A picture, poster, or stylesheet address the preview must not load. */
export function isBlockedPreviewResource(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = decodedHref(value);
  if (normalized.startsWith('/') || normalized.startsWith('\\')) {
    return true;
  }
  return isBlockedPreviewHref(value);
}

function filterSrcSet(value: string, blocked: (url: string) => boolean): string | undefined {
  const kept = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => {
      const url = part.split(/\s+/)[0] ?? '';
      return url.length > 0 && !blocked(url);
    });
  return kept.length > 0 ? kept.join(', ') : undefined;
}

/** Keep only the candidates in a srcset that the preview can load. */
export function safePreviewSrcSet(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return filterSrcSet(value, (url) => isBlockedPreviewHref(url));
}

const LINK_ATTRIBUTES = new Set(['href', 'action', 'formaction', 'cite']);
const RESOURCE_ATTRIBUTES = new Set([
  'src',
  'poster',
  'background',
  'data',
  'xlink:href',
  'xlinkhref',
]);

function blockedCssAddress(address: string): boolean {
  const decoded = decodeCssEscapes(address.trim());
  return decoded.length > 0 && isBlockedPreviewResource(decoded);
}

function sanitizePreviewImport(css: string): string {
  return stripCssComments(css).replace(
    /@import\s+(?:url\(\s*(?:(['"])([\s\S]*?)\1|([^)'"\s]+))\s*\)|(['"])([\s\S]*?)\4)/gi,
    (
      full,
      _quote: string,
      quotedUrl: string | undefined,
      bare: string | undefined,
      _plain: string,
      quoted: string | undefined
    ) => {
      const address = (quotedUrl ?? bare ?? quoted ?? '').trim();
      return blockedCssAddress(address) ? '' : full;
    }
  );
}

/** Drop a local file from CSS text, including a style element body. */
export function sanitizePreviewStyleSheet(css: string): string {
  return sanitizePreviewStyle(sanitizePreviewImport(css));
}

function sanitizePreviewStyle(value: string): string {
  return stripCssComments(value).replace(
    /url\(\s*(?:(['"])([\s\S]*?)\1|([^)'"\s]+))\s*\)/gi,
    (full, _quote: string, quoted: string | undefined, bare: string | undefined) => {
      const address = (quoted ?? bare ?? '').trim();
      return blockedCssAddress(address) ? 'none' : full;
    }
  );
}

function cssPropertyName(property: string): string {
  return property.replace(/-([a-z])/gi, (_match, letter: string) => letter.toUpperCase());
}

/** React rejects a style string, so a safe declaration list becomes an object. */
function styleObject(value: string): Record<string, string> | undefined {
  const style: Record<string, string> = {};
  for (const part of sanitizePreviewStyle(value).split(';')) {
    const separator = part.indexOf(':');
    if (separator <= 0) {
      continue;
    }
    const property = part.slice(0, separator).trim();
    const cssValue = part.slice(separator + 1).trim();
    if (cssValue.length === 0 || isBlockedPreviewResource(cssValue)) {
      continue;
    }
    if (property.startsWith('--') && /^--[a-z-]+$/i.test(property)) {
      style[property] = cssValue;
      continue;
    }
    if (/^[a-z-]+$/i.test(property)) {
      style[cssPropertyName(property)] = cssValue;
    }
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

function nextAttribute(name: string, value: string): { readonly value: unknown } | undefined {
  if (name === 'style') {
    return { value: styleObject(value) };
  }
  if (name === 'srcdoc') {
    return { value: undefined };
  }
  if (name === 'srcset') {
    const kept = filterSrcSet(value, (url) => isBlockedPreviewResource(url));
    return kept === value ? undefined : { value: kept };
  }
  if (LINK_ATTRIBUTES.has(name) && isBlockedPreviewHref(value)) {
    return { value: undefined };
  }
  if (RESOURCE_ATTRIBUTES.has(name) && isBlockedPreviewResource(value)) {
    return { value: undefined };
  }
  return undefined;
}

const REACT_ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
  srcset: 'srcSet',
  formaction: 'formAction',
  xlinkhref: 'xlinkHref',
  'xlink:href': 'xlinkHref',
};

/**
 * Drop a local file from props on a plain HTML tag.
 * Compiled raw HTML does not go through the preview components.
 */
export function confinePreviewProps(props: unknown): unknown {
  if (props === null || typeof props !== 'object') {
    return props;
  }
  const entries = Object.entries(props as Record<string, unknown>);
  const nextEntries: [string, unknown][] = [];
  let changed = false;
  for (const [key, value] of entries) {
    const name = key.toLowerCase();
    const reactName = REACT_ATTRIBUTE_NAMES[name];
    const next = typeof value === 'string' ? nextAttribute(name, value) : undefined;
    if (next === undefined && (reactName === undefined || reactName === key)) {
      nextEntries.push([key, value]);
      continue;
    }
    changed = true;
    const output = next === undefined ? value : next.value;
    if (output !== undefined) {
      nextEntries.push([reactName ?? key, output]);
    }
  }
  return changed ? Object.fromEntries(nextEntries) : props;
}

function cleanStyleChild(child: unknown): unknown {
  return typeof child === 'string' ? sanitizePreviewStyleSheet(child) : child;
}

/** Drop a local file from a plain tag, including the text of a style element. */
export function confinePreviewElement(type: unknown, props: unknown): unknown {
  const confined = confinePreviewProps(props);
  if (type !== 'style' || confined === null || typeof confined !== 'object') {
    return confined;
  }
  const record = confined as Record<string, unknown>;
  const children = record.children;
  const cleaned = Array.isArray(children) ? children.map(cleanStyleChild) : cleanStyleChild(children);
  if (cleaned === children) {
    return confined;
  }
  return { ...record, children: cleaned };
}
