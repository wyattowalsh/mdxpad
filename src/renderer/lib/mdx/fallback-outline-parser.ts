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

// ============================================================================
// Regex Patterns
// ============================================================================

/**
 * Matches Markdown headings: # Heading, ## Heading, etc.
 * Captures: depth (number of #), text content
 * Uses [^\S\r\n] to match whitespace but not newlines.
 */
const HEADING_REGEX = /^(#{1,6})[^\S\r\n]+(.+?)[^\S\r\n]*$/gm;

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
  return (beforeOffset.match(/\n/g) || []).length + 1;
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
 * Parse YAML-like frontmatter content.
 * Simple key-value parsing for common cases.
 *
 * @param yaml - YAML string content
 * @returns Parsed key-value pairs
 */
function parseYamlContent(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for array item
    if (trimmed.startsWith('- ') && currentKey && currentArray) {
      currentArray.push(trimmed.slice(2).trim());
      result[currentKey] = currentArray;
      continue;
    }

    // Check for key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      // Save previous array if any
      if (currentKey && currentArray) {
        result[currentKey] = currentArray;
      }

      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (value === '' || value === '|' || value === '>') {
        // Start of array or multiline value
        currentKey = key;
        currentArray = [];
      } else {
        // Simple key-value
        currentKey = null;
        currentArray = null;

        // Parse value type
        if (value === 'true') {
          result[key] = true;
        } else if (value === 'false') {
          result[key] = false;
        } else if (/^-?\d+$/.test(value)) {
          result[key] = parseInt(value, 10);
        } else if (/^-?\d+\.\d+$/.test(value)) {
          result[key] = parseFloat(value);
        } else {
          // String value - strip quotes if present
          result[key] = value.replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  return result;
}

/**
 * Count the number of lines in frontmatter block.
 *
 * @param frontmatterMatch - Regex match for frontmatter
 * @returns Line number where frontmatter ends (after closing ---)
 */
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
export function parseFallbackOutline(source: string): OutlineAST {
  const headings: HeadingNode[] = [];
  const components: ComponentNode[] = [];
  let frontmatter: FrontmatterData | null = null;

  // -------------------------------------------------------------------------
  // Extract frontmatter
  // -------------------------------------------------------------------------
  const frontmatterMatch = source.match(FRONTMATTER_REGEX);
  if (frontmatterMatch) {
    const yamlContent = frontmatterMatch[1] || '';
    const parsedData = parseYamlContent(yamlContent);
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
    const hashes = headingMatch[1] || '';
    const text = headingMatch[2] || '';
    const depth = hashes.length as 1 | 2 | 3 | 4 | 5 | 6;

    // Skip empty or whitespace-only headings
    if (!text.trim()) continue;

    // Skip headings inside frontmatter (before closing ---)
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

  // -------------------------------------------------------------------------
  // Extract JSX components
  // -------------------------------------------------------------------------
  JSX_COMPONENT_REGEX.lastIndex = 0; // Reset regex state
  let componentMatch: RegExpExecArray | null;
  const seenComponents = new Set<string>(); // Track unique component instances by position

  while ((componentMatch = JSX_COMPONENT_REGEX.exec(source)) !== null) {
    const name = componentMatch[1] || '';
    const line = getLineNumber(source, componentMatch.index);
    const column = getColumnNumber(source, componentMatch.index);

    // Create unique key to avoid duplicate entries for same component instance
    const key = `${name}-${line}-${column}`;
    if (seenComponents.has(key)) continue;
    seenComponents.add(key);

    // Skip components inside frontmatter
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
