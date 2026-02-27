/**
 * Shared metadata utilities for frontmatter normalization and indexing.
 */

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const TOP_LEVEL_HEADING_REGEX = /^#\s+(.+?)(?:\s+#*)?\s*$/m;
const TAG_FIELDS = ['tags', 'tag', 'categories', 'category', 'keywords'] as const;

export type NormalizedFrontmatterValue =
  | string
  | number
  | boolean
  | null
  | readonly NormalizedFrontmatterValue[]
  | { readonly [key: string]: NormalizedFrontmatterValue };

export interface ExtractedDocumentMetadata {
  readonly frontmatter: Readonly<Record<string, NormalizedFrontmatterValue>>;
  readonly rawFrontmatter: string;
  readonly body: string;
  readonly hasFrontmatter: boolean;
  readonly title: string | null;
  readonly slug: string;
  readonly tags: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '');
}

function parseInlineArray(value: string): string[] | null {
  if (!value.startsWith('[') || !value.endsWith(']')) {
    return null;
  }

  const inner = value.slice(1, -1).trim();
  if (!inner) {
    return [];
  }

  return inner
    .split(',')
    .map((item) => stripQuotes(item.trim()))
    .filter((item) => item.length > 0);
}

function parseScalar(value: string): unknown {
  const inlineArray = parseInlineArray(value);
  if (inlineArray !== null) {
    return inlineArray;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }

  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }

  return stripQuotes(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

function flattenTagValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenTagValues(item));
  }

  const normalized = asNonEmptyString(value);
  return normalized ? splitTags(normalized) : [];
}

function extractHeadingTitle(content: string): string | null {
  const match = TOP_LEVEL_HEADING_REGEX.exec(content);
  return asNonEmptyString(match?.[1]);
}

function extractFrontmatterParts(content: string): {
  readonly rawFrontmatter: string;
  readonly body: string;
  readonly hasFrontmatter: boolean;
} {
  const match = FRONTMATTER_REGEX.exec(content);
  if (!match) {
    return {
      rawFrontmatter: '',
      body: content,
      hasFrontmatter: false,
    };
  }

  const rawFrontmatter = match[1] ?? '';
  const body = content.slice(match[0].length).replace(/^\r?\n/, '');
  return {
    rawFrontmatter,
    body,
    hasFrontmatter: true,
  };
}

/**
 * Parses YAML-like frontmatter content using a lightweight best-effort parser.
 */
export function parseFrontmatterYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('- ') && currentKey && currentArray) {
      currentArray.push(stripQuotes(trimmed.slice(2).trim()));
      result[currentKey] = currentArray;
      continue;
    }

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex <= 0) continue;

    if (currentKey && currentArray) {
      result[currentKey] = currentArray;
    }

    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();

    if (value === '' || value === '|' || value === '>') {
      currentKey = key;
      currentArray = [];
      continue;
    }

    currentKey = null;
    currentArray = null;
    result[key] = parseScalar(value);
  }

  return result;
}

/**
 * Normalizes a single frontmatter value into index-friendly scalar/array/object types.
 */
export function normalizeFrontmatterValue(value: unknown): NormalizedFrontmatterValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeFrontmatterValue(item));
  }

  if (isRecord(value)) {
    return normalizeFrontmatter(value);
  }

  return null;
}

/**
 * Normalizes a frontmatter object recursively.
 */
export function normalizeFrontmatter(
  frontmatter: Record<string, unknown>
): Record<string, NormalizedFrontmatterValue> {
  const normalized: Record<string, NormalizedFrontmatterValue> = {};

  for (const [key, value] of Object.entries(frontmatter)) {
    normalized[key] = normalizeFrontmatterValue(value);
  }

  return normalized;
}

/** Maximum input length for slug generation to prevent ReDoS on untrusted input. */
const MAX_SLUG_INPUT_LENGTH = 500;

/**
 * Converts arbitrary text into a deterministic URL-safe slug.
 * @param value - Text to slugify
 * @param fallback - Fallback slug when the result would be empty
 * @param existingSlugs - Optional set of existing slugs for collision disambiguation
 * @returns URL-safe slug string, with numeric suffix if disambiguation is needed
 */
export function toSlug(
  value: string,
  fallback = 'untitled',
  existingSlugs?: ReadonlySet<string>
): string {
  // Guard against excessively long input that could cause ReDoS
  const safeInput =
    value.length > MAX_SLUG_INPUT_LENGTH ? value.slice(0, MAX_SLUG_INPUT_LENGTH) : value;

  const slug =
    safeInput
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback;

  if (!existingSlugs?.has(slug)) {
    return slug;
  }

  // Disambiguate with a numeric suffix when a collision exists
  let counter = 2;
  while (existingSlugs.has(`${slug}-${counter}`)) {
    counter++;
  }
  return `${slug}-${counter}`;
}

/**
 * Derives normalized tags from common frontmatter fields.
 */
export function deriveTags(frontmatter: Record<string, unknown>): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const field of TAG_FIELDS) {
    for (const tag of flattenTagValues(frontmatter[field])) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      tags.push(tag);
    }
  }

  return tags;
}

/**
 * Derives a slug from frontmatter, preferring explicit slug and then title.
 */
export function deriveSlug(frontmatter: Record<string, unknown>, fallbackTitle?: string): string {
  const explicitSlug = asNonEmptyString(frontmatter.slug);
  if (explicitSlug) {
    return toSlug(explicitSlug);
  }

  const title = asNonEmptyString(frontmatter.title) ?? asNonEmptyString(fallbackTitle);
  return toSlug(title ?? 'untitled');
}

/**
 * Extracts frontmatter metadata and derived indexing fields from raw document content.
 */
export function extractDocumentMetadata(content: string): ExtractedDocumentMetadata {
  const { rawFrontmatter, body, hasFrontmatter } = extractFrontmatterParts(content);
  const parsedFrontmatter = hasFrontmatter ? parseFrontmatterYaml(rawFrontmatter) : {};
  const normalizedFrontmatter = normalizeFrontmatter(parsedFrontmatter);
  const title = asNonEmptyString(normalizedFrontmatter.title) ?? extractHeadingTitle(body);

  return {
    frontmatter: normalizedFrontmatter,
    rawFrontmatter,
    body,
    hasFrontmatter,
    title,
    slug: deriveSlug(normalizedFrontmatter, title ?? undefined),
    tags: deriveTags(normalizedFrontmatter),
  };
}
