/**
 * Fallback Outline Parser
 *
 * Regex-based fallback parser for extracting outline data when MDX compilation fails.
 * Provides graceful degradation by extracting headings, JSX components, and frontmatter
 * from raw source text without requiring a valid AST.
 *
 * @module renderer/lib/mdx/fallback-outline-parser
 */

import type {
  OutlineAST,
  HeadingNode,
  ComponentNode,
  FrontmatterData,
} from '@shared/types/outline';
import { parseFrontmatterYaml } from './frontmatter-yaml-parser';

// ============================================================================
// Regex Patterns
// ============================================================================

/**
 * Matches Markdown headings: # Heading, ## Heading, etc.
 * Captures: depth (number of #), text content
 * Uses [^\S\r\n] to match whitespace but not newlines.
 */
const HEADING_REGEX = /^(#{1,6})[^\S\r\n]+(.+?)[^\S\r\n]*$/gm;
const SETEXT_UNDERLINE = /^(=+|-+)[^\S\r\n]*$/;

/**
 * Matches JSX component opening tags: <ComponentName ...>
 * Captures: component name (PascalCase convention)
 * Handles self-closing tags and tags with attributes.
 */
const JSX_COMPONENT_REGEX = /<([A-Z][A-Za-z0-9]*)\s*(?:[^>]*)?>/gm;

/**
 * Matches YAML frontmatter block: ---\n...\n---
 * Captures: content between delimiters
 */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate line number for a given character offset.
 *
 * @param source - Full source text
 * @param offset - Character offset position
 * @returns 1-indexed line number
 */
function getLineNumber(source: string, offset: number): number {
  const beforeOffset = source.slice(0, offset);
  return (beforeOffset.match(/\n/g) ?? []).length + 1;
}

/**
 * Calculate column number for a given character offset.
 *
 * @param source - Full source text
 * @param offset - Character offset position
 * @returns 1-indexed column number
 */
function getColumnNumber(source: string, offset: number): number {
  const lastNewline = source.lastIndexOf('\n', offset - 1);
  return offset - lastNewline;
}

/**
 * Count the number of lines in frontmatter block.
 *
 * @param frontmatterMatch - Regex match for frontmatter
 * @returns Line number where frontmatter ends (after closing ---)
 */
function updateFence(fence: string | null, line: string): string | null {
  const match = /^(?: {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) {
    return fence;
  }
  const marker = match[1] ?? '';
  const info = (match[2] ?? '').trim();
  if (fence === null) {
    return marker;
  }
  if (info.length === 0 && marker.startsWith(fence[0] ?? '') && marker.length >= fence.length) {
    return null;
  }
  return fence;
}

function collectSetextHeadings(source: string, frontmatterEnd: number): HeadingNode[] {
  const headings: HeadingNode[] = [];
  const lines = source.split(/\r?\n/);
  let offset = 0;
  let fence: string | null = null;
  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index] ?? '';
    const next = lines[index + 1] ?? '';
    const lineOffset = offset;
    offset += line.length + 1;
    if (lineOffset < frontmatterEnd) {
      continue;
    }
    const openFence = fence;
    fence = updateFence(fence, line);
    if (openFence !== null || line.trim().length === 0 || /^#{1,6}(?:[^\S\r\n]|$)/.test(line)) {
      continue;
    }
    const underline = SETEXT_UNDERLINE.exec(next);
    const marks = underline?.[1] ?? '';
    if (marks.length === 0) {
      continue;
    }
    headings.push({
      depth: marks.startsWith('=') ? 1 : 2,
      text: line.trim(),
      position: { line: index + 1, column: 1 },
    });
  }
  return headings;
}

function getFrontmatterEndLine(frontmatterMatch: RegExpMatchArray): number {
  const content = frontmatterMatch[0];
  const lines = content.split('\n');
  return lines.length;
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse outline data from raw MDX source using regex.
 * Used as fallback when MDX compilation fails.
 *
 * @param source - Raw MDX source text
 * @returns Extracted outline data (partial, best-effort)
 *
 * @example
 * ```typescript
 * // When compilation fails, use fallback parser
 * const outline = parseFallbackOutline(source);
 * // Returns headings, components, frontmatter extracted via regex
 * ```
 */
// eslint-disable-next-line max-lines-per-function
export function parseFallbackOutline(source: string): OutlineAST {
  const headings: HeadingNode[] = [];
  const components: ComponentNode[] = [];
  let frontmatter: FrontmatterData | null = null;

  // -------------------------------------------------------------------------
  // Extract frontmatter
  // -------------------------------------------------------------------------
  const frontmatterMatch = FRONTMATTER_REGEX.exec(source);
  if (frontmatterMatch) {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const yamlContent = frontmatterMatch[1] || '';
    const parsedData = parseFrontmatterYaml(yamlContent);
    const endLine = getFrontmatterEndLine(frontmatterMatch);

    frontmatter = {
      data: parsedData,
      endLine,
    };
  }

  // -------------------------------------------------------------------------
  // Extract headings
  // -------------------------------------------------------------------------
  HEADING_REGEX.lastIndex = 0; // Reset regex state
  let headingMatch: RegExpExecArray | null;

  while ((headingMatch = HEADING_REGEX.exec(source)) !== null) {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const hashes = headingMatch[1] || '';
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const text = headingMatch[2] || '';
    const depth = hashes.length as 1 | 2 | 3 | 4 | 5 | 6;

    // Skip empty or whitespace-only headings
    if (!text.trim()) continue;

    // Skip headings inside frontmatter (before closing ---)
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (frontmatter && headingMatch.index < (frontmatterMatch?.[0]?.length || 0)) {
      continue;
    }

    headings.push({
      depth,
      text: text.trim(),
      position: {
        line: getLineNumber(source, headingMatch.index),
        column: getColumnNumber(source, headingMatch.index),
      },
    });
  }

  headings.push(...collectSetextHeadings(source, frontmatterMatch?.[0]?.length ?? 0));
  headings.sort(
    (left, right) =>
      left.position.line - right.position.line || left.position.column - right.position.column
  );

  // -------------------------------------------------------------------------
  // Extract JSX components
  // -------------------------------------------------------------------------
  JSX_COMPONENT_REGEX.lastIndex = 0; // Reset regex state
  let componentMatch: RegExpExecArray | null;
  const seenComponents = new Set<string>(); // Track unique component instances by position

  while ((componentMatch = JSX_COMPONENT_REGEX.exec(source)) !== null) {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const name = componentMatch[1] || '';
    const line = getLineNumber(source, componentMatch.index);
    const column = getColumnNumber(source, componentMatch.index);

    // Create unique key to avoid duplicate entries for same component instance
    const key = `${name}-${line}-${column}`;
    if (seenComponents.has(key)) continue;
    seenComponents.add(key);

    // Skip components inside frontmatter
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (frontmatter && componentMatch.index < (frontmatterMatch?.[0]?.length || 0)) {
      continue;
    }

    components.push({
      name,
      position: { line, column },
    });
  }

  return {
    headings,
    components,
    frontmatter,
  };
}

/**
 * Check if source text appears to have any outline-relevant content.
 * Fast check to avoid parsing empty or minimal documents.
 *
 * @param source - Raw MDX source text
 * @returns True if source likely contains headings, components, or frontmatter
 */
export function hasOutlineContent(source: string): boolean {
  if (!source || source.length < 3) return false;

  // Quick checks for likely outline content
  return (
    source.includes('#') || // Potential heading
    source.includes('<') || // Potential JSX component
    source.startsWith('---') // Potential frontmatter
  );
}
