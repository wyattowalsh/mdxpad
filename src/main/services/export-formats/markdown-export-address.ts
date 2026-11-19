/**
 * Addresses that can appear in exported HTML.
 * A picture or link must not point at a local file.
 */

import {
  cssValueHasBlockedAddress,
  replaceCssImageFunctionAddresses,
} from '@shared/lib/css-image-function';
import { decodeCssEscapes, stripCssComments } from '@shared/lib/css-escape';
import { decodeAddressEntities } from '@shared/lib/html-numeric-reference';

const URL_ATTRIBUTES = new Set([
  'href',
  'src',
  'data',
  'action',
  'formaction',
  'poster',
  'cite',
  'background',
  'srcset',
  'imagesrcset',
  'longdesc',
  'xlink:href',
]);

const DROPPED_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'base',
  'link',
  'frame',
  'frameset',
  'meta',
]);

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

function decodedAddress(value: string): string {
  let current = withoutHiddenBreaks(decodeAddressEntities(value));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = withoutHiddenBreaks(decodeAddressEntities(decodeURIComponent(current)));
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
  const normalized = decodedAddress(value);
  const separator = normalized.indexOf(':');
  if (separator <= 0) {
    return null;
  }
  const scheme = normalized.slice(0, separator).toLowerCase();
  return /^[a-z][a-z0-9+.-]*$/.test(scheme) ? scheme : null;
}

let checkingSvgData = false;

function svgPayload(destination: string): string | null {
  const decoded = decodedAddress(destination).trim();
  const comma = decoded.indexOf(',');
  if (comma < 0) {
    return null;
  }
  const header = decoded.slice(0, comma).toLowerCase().replaceAll(/\s+/g, '');
  if (!header.startsWith('data:image/svg+xml')) {
    return null;
  }
  const body = decoded.slice(comma + 1);
  return header.includes(';base64') ? Buffer.from(body, 'base64').toString('utf8') : body;
}

function svgDataLoadsLocalFile(destination: string): boolean {
  const decoded = decodedAddress(destination).trim().toLowerCase();
  if (!decoded.startsWith('data:image/svg+xml')) {
    return false;
  }
  const payload = svgPayload(destination);
  if (payload === null) {
    return true;
  }
  checkingSvgData = true;
  try {
    return sanitizeExportedHtml(payload) !== payload;
  } finally {
    checkingSvgData = false;
  }
}

/** An image address the exported page can request. */
export function safeImageAddress(destination: string): string | null {
  const scheme = addressScheme(destination);
  if (scheme === 'http' || scheme === 'https') {
    return destination;
  }
  if (scheme === 'data' && decodedAddress(destination).toLowerCase().startsWith('data:image/')) {
    const svg = decodedAddress(destination).trim().toLowerCase().startsWith('data:image/svg+xml');
    if (checkingSvgData) {
      return svg ? null : destination;
    }
    return svgDataLoadsLocalFile(destination) ? null : destination;
  }
  if (scheme !== null || rootedPath(destination) || climbsOut(destination)) {
    return null;
  }
  return destination;
}

function rootedPath(destination: string): boolean {
  const decoded = decodedAddress(destination);
  return decoded.startsWith('/') || decoded.startsWith('\\');
}

function climbsOut(destination: string): boolean {
  return decodedAddress(destination)
    .replaceAll('\\', '/')
    .split('/')
    .some((part) => part === '..');
}

/** A link address the exported page can open. */
export function safeLinkAddress(destination: string): string | null {
  if (rootedPath(destination)) {
    return null;
  }
  const scheme = addressScheme(destination);
  if (scheme === null || scheme === 'http' || scheme === 'https' || scheme === 'mailto') {
    return destination;
  }
  return null;
}

function tagName(tag: string): string {
  return /^<\s*\/?\s*([A-Za-z][A-Za-z0-9-]*)/.exec(tag)?.[1]?.toLowerCase() ?? '';
}

function attributeValue(raw: string): string {
  return raw.startsWith('"') || raw.startsWith("'") ? raw.slice(1, -1) : raw;
}

function srcsetAllowed(value: string): boolean {
  return value.split(',').every((part) => {
    const url = part.trim().split(/\s+/)[0] ?? '';
    return url.length === 0 || safeImageAddress(url) !== null;
  });
}

function pingAttribute(attr: string, raw: string): string {
  const kept = attributeValue(raw)
    .split(/\s+/)
    .filter((url) => {
      const scheme = addressScheme(url);
      return scheme === 'http' || scheme === 'https';
    });
  if (kept.length === 0) {
    return '';
  }
  if (kept.join(' ') === attributeValue(raw)) {
    return ` ${attr}=${raw}`;
  }
  return ` ${attr}="${kept.join(' ')}"`;
}

const SMIL_TAGS = new Set(['animate', 'animatetransform', 'animatemotion', 'set']);
const SMIL_VALUE_ATTRIBUTES = new Set(['to', 'from', 'by', 'values']);

function smilValueAllowed(value: string): boolean {
  return !cssValueLoadsLocalFile(value) && safeImageAddress(value) !== null;
}

function attributeAllowed(name: string, value: string): boolean {
  if (name === 'srcset' || name === 'imagesrcset') {
    return srcsetAllowed(value);
  }
  if (name === 'action' || name === 'formaction') {
    return safeLinkAddress(value) !== null && !climbsOut(value);
  }
  const image = name === 'src' || name === 'poster' || name === 'background';
  return (image ? safeImageAddress(value) : safeLinkAddress(value)) !== null;
}

function cssAddress(address: string): string {
  return decodeCssEscapes(decodeAddressEntities(address.trim()));
}

function blockedCssAddress(address: string): boolean {
  const decoded = cssAddress(address);
  return decoded.length > 0 && safeImageAddress(decoded) === null;
}

function sanitizeStyleValue(value: string): string {
  const visible = decodeCssEscapes(decodeAddressEntities(stripCssComments(value)));
  const urls = visible.replace(
    /url\(\s*(?:(['"])([\s\S]*?)\1|([^)'"\s]+))\s*\)/gi,
    (full, _quote: string, quoted: string | undefined, bare: string | undefined) => {
      const address = cssAddress(quoted ?? bare ?? '');
      return safeImageAddress(address) === null ? 'none' : full;
    }
  );
  return replaceCssImageFunctionAddresses(urls, blockedCssAddress);
}

function sanitizeStyleSheet(css: string): string {
  const visible = decodeCssEscapes(decodeAddressEntities(stripCssComments(css)));
  const withoutImport = visible.replace(
    /@import\s+(?:url\(\s*(?:(['"])([\s\S]*?)\1|([^)'"\s]+))\s*\)|(['"])([\s\S]*?)\4)/gi,
    (
      full,
      _quote: string,
      quotedUrl: string | undefined,
      bare: string | undefined,
      _plain: string,
      quoted: string | undefined
    ) => {
      const address = cssAddress(quotedUrl ?? bare ?? quoted ?? '');
      return safeImageAddress(address) === null ? '' : full;
    }
  );
  return sanitizeStyleValue(withoutImport);
}

function styleBlock(html: string, start: number, end: number): { text: string; next: number } {
  const open = sanitizeExportedTag(html.slice(start, end));
  const close = /<\/style\s*>/i.exec(html.slice(end));
  if (!close) {
    return { text: open, next: end };
  }
  const closeAt = end + close.index;
  const body = sanitizeStyleSheet(html.slice(end, closeAt));
  const next = closeAt + close[0].length;
  return { text: `${open}${body}${html.slice(closeAt, next)}`, next };
}

function styleAttribute(attr: string, raw: string): string {
  const cleaned = sanitizeStyleValue(attributeValue(raw));
  if (cleaned === attributeValue(raw)) {
    return ` ${attr}=${raw}`;
  }
  const quote = raw.startsWith("'") ? "'" : '"';
  return ` ${attr}=${quote}${cleaned}${quote}`;
}

const PAINT_ATTRIBUTES = new Set([
  'fill',
  'stroke',
  'filter',
  'clippath',
  'mask',
  'cursor',
  'marker',
  'markerstart',
  'markermid',
  'markerend',
]);

function paintAttribute(name: string): boolean {
  return PAINT_ATTRIBUTES.has(name.replaceAll('-', ''));
}

function cssValueLoadsLocalFile(value: string): boolean {
  const visible = decodeCssEscapes(decodeAddressEntities(stripCssComments(value)));
  return cssValueHasBlockedAddress(visible, blockedCssAddress);
}

const RESOURCE_HREF_TAGS = new Set([
  'image',
  'use',
  'feimage',
  'cursor',
  'filter',
  'pattern',
  'mask',
  'clippath',
  'marker',
  'textpath',
  'mpath',
  'lineargradient',
  'radialgradient',
  'meshgradient',
  'animate',
  'animatetransform',
  'animatemotion',
  'set',
  'femergenode',
  'discard',
]);

function resourceHrefTag(name: string): boolean {
  return RESOURCE_HREF_TAGS.has(name);
}

/** Drop an address that would read a local file. A loading tag is removed. */
export function sanitizeExportedTag(tag: string): string {
  const element = tagName(tag);
  if (DROPPED_TAGS.has(element)) {
    return '';
  }
  return tag.replace(
    /[\s/]+([^\s=/>]+)\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/g,
    (full, attr: string, raw: string) => {
      const name = attr.toLowerCase();
      if (name === 'style') {
        return styleAttribute(attr, raw);
      }
      const value = attributeValue(raw);
      if (name === 'ping') {
        return pingAttribute(attr, raw);
      }
      if (paintAttribute(name) && cssValueLoadsLocalFile(value)) {
        return '';
      }
      if (SMIL_TAGS.has(element) && SMIL_VALUE_ATTRIBUTES.has(name) && !smilValueAllowed(value)) {
        return '';
      }
      if (resourceHrefTag(element) && (name === 'href' || name === 'xlink:href')) {
        return safeImageAddress(value) === null ? '' : full;
      }
      return URL_ATTRIBUTES.has(name) && !attributeAllowed(name, value) ? '' : full;
    }
  );
}

function htmlTagEnd(html: string, index: number): number {
  let quote: '"' | "'" | null = null;
  for (let cursor = index + 1; cursor < html.length; cursor += 1) {
    const char = html[cursor];
    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') {
      return cursor + 1;
    }
  }
  return -1;
}

/** Remove local-file addresses from an HTML fragment, including the tags that load them. */
export function sanitizeExportedHtml(html: string): string {
  let result = '';
  let index = 0;
  while (index < html.length) {
    const start = html.indexOf('<', index);
    if (start === -1) {
      return result + html.slice(index);
    }
    result += html.slice(index, start);
    const end = htmlTagEnd(html, start);
    if (end === -1) {
      return result + html.slice(start);
    }
    const tag = html.slice(start, end);
    const name = tagName(tag);
    if (name === 'style' && !/^<\s*\//.test(tag)) {
      const block = styleBlock(html, start, end);
      result += block.text;
      index = block.next;
      continue;
    }
    if (DROPPED_TAGS.has(name) && !/^<\s*\//.test(tag)) {
      const close = new RegExp(`</${name}\\s*>`, 'i').exec(html.slice(end));
      index = close ? end + close.index + close[0].length : end;
      continue;
    }
    result += sanitizeExportedTag(tag);
    index = end;
  }
  return result;
}
