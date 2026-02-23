/**
 * Outline Extractor
 *
 * Extracts outline data (headings, components, frontmatter) from MDAST.
 * Uses unist-util-visit for efficient tree traversal.
 *
 * @module renderer/lib/mdx/outline-extractor
 */

import { visit, SKIP } from 'unist-util-visit';
import type { Root, Heading, Text } from 'mdast';
import type { MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx';
import type {
  OutlineAST,
  HeadingNode,
  ComponentNode,
  FrontmatterData,
  SourcePosition,
} from '@shared/types/outline';
import { parseFrontmatterYaml } from './frontmatter-yaml-parser';

/**
 * MDX JSX node type (flow or text).
 */
type MdxJsxElement = MdxJsxFlowElement | MdxJsxTextElement;

/**
 * YAML frontmatter node in MDAST.
 */
interface YamlNode {
  type: 'yaml';
  value: string;
  position?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

/**
 * Extract text content from heading children.
 * Handles nested phrasing content (text, emphasis, strong, etc.).
 *
 * @param node - Heading node
 * @returns Plain text content of the heading
 */
function extractHeadingText(node: Heading): string {
  const textParts: string[] = [];

  visit(node, 'text', (textNode: Text) => {
    textParts.push(textNode.value);
  });

  return textParts.join('').trim();
}

/**
 * Extract source position from MDAST node.
 *
 * @param position - MDAST position object
 * @returns SourcePosition or default position if not available
 */
function extractPosition(
  position?: { start: { line: number; column: number } }
): SourcePosition {
  if (!position) {
    return { line: 1, column: 1 };
  }
  return {
    line: position.start.line,
    column: position.start.column,
  };
}

/**
 * Check if a node is an MDX JSX element (flow or text).
 *
 * @param node - Node to check
 * @returns True if node is an MDX JSX element
 */
function isMdxJsxElement(node: unknown): node is MdxJsxElement {
  if (!node || typeof node !== 'object') return false;
  const n = node as { type?: string };
  return n.type === 'mdxJsxFlowElement' || n.type === 'mdxJsxTextElement';
}

/**
 * Check if a node is a YAML frontmatter node.
 *
 * @param node - Node to check
 * @returns True if node is a YAML frontmatter node
 */
function isYamlNode(node: unknown): node is YamlNode {
  if (!node || typeof node !== 'object') return false;
  return (node as { type?: string }).type === 'yaml';
}

/**
 * Extract outline data from an MDAST tree.
 *
 * Traverses the tree to collect:
 * - Headings (h1-h6) with text and position
 * - JSX components with name and position
 * - Frontmatter data if present
 *
 * @param tree - MDAST root node
 * @param frontmatterData - Optional pre-parsed frontmatter (from vfile-matter)
 * @returns Extracted outline data
 *
 * @example
 * ```typescript
 * const tree = await parse(mdxSource);
 * const outline = extractOutline(tree, parsedFrontmatter);
 * console.log(outline.headings); // [{ depth: 1, text: 'Title', position: { line: 1, column: 1 } }]
 * ```
 */
// eslint-disable-next-line max-lines-per-function
export function extractOutline(
  tree: Root,
  frontmatterData?: Record<string, unknown>
): OutlineAST {
  const headings: HeadingNode[] = [];
  const components: ComponentNode[] = [];
  let frontmatter: FrontmatterData | null = null;
  let frontmatterEndLine = 0;

  // Process all nodes in the tree
  visit(tree, (node) => {
    // Extract headings
    if (node.type === 'heading') {
      const heading = node;
      const text = extractHeadingText(heading);

      // Only add headings with text content
      if (text) {
        headings.push({
          depth: heading.depth,
          text,
          position: extractPosition(heading.position),
        });
      }
      return SKIP; // Don't visit heading children again
    }

    // Extract MDX JSX elements
    if (isMdxJsxElement(node)) {
      const jsxNode = node;

      // Only capture named elements (not fragments)
      if (jsxNode.name) {
        components.push({
          name: jsxNode.name,
          position: extractPosition(jsxNode.position),
        });
      }
      // Continue to visit children (nested components)
    }

    // Extract YAML frontmatter
    if (isYamlNode(node)) {
      const yamlNode = node;
      const parsedData = parseFrontmatterYaml(yamlNode.value);
      frontmatterEndLine = yamlNode.position?.end.line ?? 0;

      frontmatter = {
        data: { ...parsedData, ...frontmatterData },
        endLine: frontmatterEndLine,
      };
      return SKIP;
    }

    return true; // Continue visiting
  });

  // If frontmatter was provided but not found in tree, use it directly
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- frontmatter may not be set by visitor
  if (!frontmatter && frontmatterData && Object.keys(frontmatterData).length > 0) {
    frontmatter = {
      data: frontmatterData,
      endLine: 0, // Unknown without the YAML node
    };
  }

  return {
    headings,
    components,
    frontmatter,
  };
}

/**
 * Create an empty OutlineAST.
 *
 * @returns Empty outline structure
 */
export function createEmptyOutline(): OutlineAST {
  return {
    headings: [],
    components: [],
    frontmatter: null,
  };
}
