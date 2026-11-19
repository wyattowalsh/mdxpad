import {
  cssValueHasBlockedAddress,
  replaceCssImageFunctionAddresses,
} from '@shared/lib/css-image-function';
import { decodeCssEscapes, stripCssComments } from '@shared/lib/css-escape';
import { decodeAddressEntities } from '@shared/lib/html-numeric-reference';

import { blockedDataResource, confineNavigationTag, confineSmilValues, srcsetPartBlocked } from './preview-navigation-address';

function withoutHiddenBreaks(value: string): string {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code > 31 && code !== 127) {
      result += char;
    }
  }
  return result.trim();
}

function decodedHref(value: string): string {
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
  const separator = value.indexOf(':');
  if (separator <= 0) {
    return null;
  }
  const scheme = value.slice(0, separator).toLowerCase();
  return /^[a-z][a-z0-9+.-]*$/.test(scheme) ? scheme : null;
}

function climbsOut(value: string): boolean {
  return value.replaceAll('\\', '/').split('/').some((part) => part === '..');
}

/** A relative address that leaves its folder, such as `../secret.css`. */
export function previewAddressClimbsOut(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return climbsOut(decodedHref(value));
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
  if (climbsOut(normalized)) {
    return true;
  }
  if (normalized.startsWith('/') || normalized.startsWith('\\')) {
    return true;
  }
  const data = blockedDataResource(normalized);
  if (data !== null) {
    return data;
  }
  return isBlockedPreviewHref(value);
}

function filterSrcSet(value: string, blocked: (url: string) => boolean): string | undefined {
  const kept = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => !srcsetPartBlocked(part, withoutHiddenBreaks, blocked));
  return kept.length > 0 ? kept.join(', ') : undefined;
}

/** Keep only the candidates in a srcset that the preview can load. */
export function safePreviewSrcSet(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return filterSrcSet(value, (url) => isBlockedPreviewResource(url));
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

function paintLoadsLocalFile(value: string): boolean {
  const visible = decodeCssEscapes(decodeAddressEntities(stripCssComments(value)));
  return cssValueHasBlockedAddress(visible, blockedCssAddress);
}

const LINK_ATTRIBUTES = new Set(['href', 'action', 'formaction', 'cite', 'longdesc']);
const RESOURCE_ATTRIBUTES = new Set([
  'src',
  'poster',
  'background',
  'data',
  'xlink:href',
  'xlinkhref',
]);

function blockedCssAddress(address: string): boolean {
  const decoded = decodeCssEscapes(decodeAddressEntities(address.trim()));
  return decoded.length > 0 && isBlockedPreviewResource(decoded);
}

function sanitizePreviewImport(css: string): string {
  return decodeCssEscapes(decodeAddressEntities(stripCssComments(css))).replace(
    /@import\s+(?:url\(\s*(?:(['"])([\s\S]*?)\1|([^)'"]+))\s*\)|(['"])([\s\S]*?)\4)/gi,
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
  const visible = decodeCssEscapes(decodeAddressEntities(stripCssComments(value)));
  const urls = visible.replace(
    /url\(\s*(?:(['"])([\s\S]*?)\1|([^)'"]+))\s*\)/gi,
    (full, _quote: string, quoted: string | undefined, bare: string | undefined) => {
      const address = (quoted ?? bare ?? '').trim();
      return blockedCssAddress(address) ? 'none' : full;
    }
  );
  return replaceCssImageFunctionAddresses(urls, blockedCssAddress);
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

function cssDeclarationName(property: string): string | null {
  if (property.startsWith('--')) {
    return /^--[a-z0-9-]+$/i.test(property) ? property : null;
  }
  const kebab = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).toLowerCase();
  return /^[a-z-]+$/.test(kebab) ? kebab : null;
}

function styleRecord(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const kept: Record<string, unknown> = {};
  const declarations: string[] = [];
  for (const [property, raw] of Object.entries(value)) {
    if (typeof raw !== 'string') {
      if (typeof raw === 'number') {
        kept[property] = raw;
      }
      continue;
    }
    const name = cssDeclarationName(property);
    if (name !== null) {
      declarations.push(`${name}: ${raw}`);
    }
  }
  const style = { ...kept, ...styleObject(declarations.join(';')) };
  return Object.keys(style).length > 0 ? style : undefined;
}

function isStyleRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nextAttribute(name: string, value: string): { readonly value: unknown } | undefined {
  if (name === 'style') {
    return { value: styleObject(value) };
  }
  if (name === 'srcdoc') {
    return { value: undefined };
  }
  if (name === 'srcset' || name === 'imagesrcset') {
    const kept = filterSrcSet(value, (url) => isBlockedPreviewResource(url));
    return kept === value ? undefined : { value: kept };
  }
  if (name === 'ping') {
    return pingValue(value);
  }
  const climbsNavigation =
    (name === 'action' || name === 'formaction') && previewAddressClimbsOut(value);
  if (LINK_ATTRIBUTES.has(name) && (isBlockedPreviewHref(value) || climbsNavigation)) {
    return { value: undefined };
  }
  if (RESOURCE_ATTRIBUTES.has(name) && isBlockedPreviewResource(value)) {
    return { value: undefined };
  }
  if (paintAttribute(name) && paintLoadsLocalFile(value)) {
    return { value: undefined };
  }
  return undefined;
}

function pingValue(value: string): { readonly value: string | undefined } | undefined {
  const kept = value.split(/\s+/).filter((url) => {
    const scheme = addressScheme(url);
    return scheme === 'http' || scheme === 'https';
  });
  const next = kept.join(' ');
  if (next === value) {
    return undefined;
  }
  return { value: next.length > 0 ? next : undefined };
}

const REACT_ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
  srcset: 'srcSet',
  imagesrcset: 'imageSrcSet',
  longdesc: 'longDesc',
  formaction: 'formAction',
  xlinkhref: 'xlinkHref',
  'xlink:href': 'xlinkHref',
};

export function confinePreviewProps(props: unknown): unknown {
  if (props === null || typeof props !== 'object') {
    return props;
  }
  const entries = Object.entries(props as Record<string, unknown>);
  const nextEntries: [string, unknown][] = [];
  let changed = false;
  for (const [key, value] of entries) {
    if (key === 'dangerouslySetInnerHTML') {
      changed = true;
      continue;
    }
    const name = key.toLowerCase();
    if (name.length > 2 && name.startsWith('on')) {
      changed = true;
      continue;
    }
    if (name === 'style' && isStyleRecord(value)) {
      changed = true;
      const style = styleRecord(value);
      if (style !== undefined) {
        nextEntries.push([key, style]);
      }
      continue;
    }
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

function loadsResourceHref(type: unknown): boolean {
  return typeof type === 'string' && RESOURCE_HREF_TAGS.has(type.toLowerCase());
}

function omitBlockedResourceHref(props: Record<string, unknown>): Record<string, unknown> {
  const entries = Object.entries(props).filter(([key, value]) => {
    const name = key.toLowerCase();
    if (name !== 'href' && name !== 'xlinkhref') {
      return true;
    }
    return typeof value !== 'string' || !isBlockedPreviewResource(value);
  });
  return entries.length === Object.keys(props).length ? props : Object.fromEntries(entries);
}

/** Drop a local file from a plain tag, including the text of a style element. */
export function confinePreviewElement(type: unknown, props: unknown): unknown {
  const confined = confinePreviewProps(props);
  if (confined === null || typeof confined !== 'object') {
    return confined;
  }
  const record = confineSmilValues(
    type,
    confineNavigationTag(type, confined as Record<string, unknown>, isBlockedPreviewResource),
    (value) => paintLoadsLocalFile(value) || isBlockedPreviewResource(value)
  );
  const withoutResourceHref = loadsResourceHref(type) ? omitBlockedResourceHref(record) : record;
  if (type !== 'style') {
    return withoutResourceHref;
  }
  const children = withoutResourceHref.children;
  const cleaned = Array.isArray(children) ? children.map(cleanStyleChild) : cleanStyleChild(children);
  if (cleaned === children) {
    return withoutResourceHref;
  }
  return { ...withoutResourceHref, children: cleaned };
}
