/**
 * Raw HTML skips the preview components, so base, link, area, and refresh
 * need the same address checks those components already apply.
 */

import { safeImageAddress } from '../../main/services/export-formats/markdown-export-address';

/** A data image the preview must not load. Null when the address is not a data URL. */
export function blockedDataResource(value: string): boolean | null {
  const separator = value.indexOf(':');
  if (separator <= 0 || value.slice(0, separator).trim().toLowerCase() !== 'data') {
    return null;
  }
  return safeImageAddress(value) === null;
}

function withoutHref(
  props: Record<string, unknown>,
  blocked: (value: string) => boolean
): Record<string, unknown> {
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const name = key.toLowerCase();
    if ((name === 'href' || name === 'xlinkhref') && typeof value === 'string' && blocked(value)) {
      changed = true;
      continue;
    }
    next[key] = value;
  }
  return changed ? next : props;
}

function refreshUrl(content: string): string | null {
  const match = /^\s*\d+(?:\.\d+)?\s*;\s*url\s*=\s*(['"]?)(.*?)\1\s*$/i.exec(content.trim());
  const url = match?.[2]?.trim();
  return url && url.length > 0 ? url : null;
}

function withReactRefresh(props: Record<string, unknown>): Record<string, unknown> {
  if (!Object.hasOwn(props, 'http-equiv')) {
    return props;
  }
  const next: Record<string, unknown> = { ...props, httpEquiv: props['http-equiv'] };
  delete next['http-equiv'];
  return next;
}

function withoutUnsafeRefresh(
  props: Record<string, unknown>,
  blocked: (value: string) => boolean
): Record<string, unknown> {
  const equiv = props.httpEquiv ?? props['http-equiv'];
  const content = props.content;
  if (
    typeof equiv !== 'string' ||
    equiv.trim().toLowerCase() !== 'refresh' ||
    typeof content !== 'string'
  ) {
    return props;
  }
  const url = refreshUrl(content);
  if (url === null || !blocked(url)) {
    return props;
  }
  const next = { ...props };
  delete next.content;
  return next;
}

const SMIL_TAGS = new Set(['animate', 'animatetransform', 'animatemotion', 'set']);
const SMIL_VALUE_ATTRIBUTES = new Set(['to', 'from', 'by', 'values']);

/** Drop an animation value that would load a local file. */
export function confineSmilValues(
  type: unknown,
  props: Record<string, unknown>,
  blocked: (value: string) => boolean
): Record<string, unknown> {
  if (typeof type !== 'string' || !SMIL_TAGS.has(type.toLowerCase())) {
    return props;
  }
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (
      SMIL_VALUE_ATTRIBUTES.has(key.toLowerCase()) &&
      typeof value === 'string' &&
      blocked(value)
    ) {
      changed = true;
      continue;
    }
    next[key] = value;
  }
  return changed ? next : props;
}

/** Drop a raw tag address that would retarget or load a local file. */
export function confineNavigationTag(
  type: unknown,
  props: Record<string, unknown>,
  blocked: (value: string) => boolean
): Record<string, unknown> {
  if (typeof type !== 'string') {
    return props;
  }
  const tag = type.toLowerCase();
  if (tag === 'base') {
    return withoutHref(props, () => true);
  }
  if (tag === 'link' || tag === 'area') {
    return withoutHref(props, blocked);
  }
  if (tag === 'meta') {
    return withoutUnsafeRefresh(withReactRefresh(props), blocked);
  }
  return props;
}
