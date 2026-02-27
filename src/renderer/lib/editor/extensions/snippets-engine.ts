/**
 * Snippet Engine Extension for CodeMirror
 *
 * Provides a custom snippet system with tab-stop expansion
 * and built-in MDX snippets via CodeMirror autocompletion.
 *
 * @module renderer/lib/editor/extensions/snippets-engine
 */

import {
  autocompletion,
  snippet,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { type Extension } from '@codemirror/state';

// =============================================================================
// Types
// =============================================================================

/**
 * A custom snippet definition.
 */
export interface Snippet {
  /** Trigger prefix (what the user types) */
  readonly prefix: string;
  /** Display label in completion menu */
  readonly label: string;
  /** Optional description shown in completion detail */
  readonly description?: string;
  /**
   * Snippet body with tab stops.
   * Uses CodeMirror snippet syntax: #{n} for stops, #{n:default} for defaults.
   * Example: "const #{1:name} = #{2:value};"
   */
  readonly body: string;
}

// =============================================================================
// Built-in MDX Snippets
// =============================================================================

/**
 * Built-in snippets for common MDX patterns.
 */
export const MDX_SNIPPETS: readonly Snippet[] = [
  {
    prefix: 'component',
    label: 'MDX Component',
    description: 'React component in MDX',
    body: '<${1:Component} ${2:prop}="${3:value}">\n  ${4:children}\n</${1:Component}>',
  },
  {
    prefix: 'codefence',
    label: 'Code Fence',
    description: 'Fenced code block',
    body: '```${1:language}\n${2:code}\n```',
  },
  {
    prefix: 'frontmatter',
    label: 'Frontmatter',
    description: 'YAML frontmatter block',
    body: '---\ntitle: ${1:Title}\ndate: ${2:2024-01-01}\n---\n',
  },
  {
    prefix: 'import',
    label: 'Import Statement',
    description: 'ES module import',
    body: "import { ${2:Component} } from '${1:module}';",
  },
  {
    prefix: 'export',
    label: 'Export Default',
    description: 'Default export',
    body: 'export default ${1:value};',
  },
  {
    prefix: 'callout',
    label: 'Callout Block',
    description: 'Callout/admonition component',
    body: '<Callout type="${1|note,warning,error,tip|}">\n  ${2:content}\n</Callout>',
  },
  {
    prefix: 'table',
    label: 'Markdown Table',
    description: 'Markdown table with header',
    body: '| ${1:Header 1} | ${2:Header 2} |\n| --- | --- |\n| ${3:Cell 1} | ${4:Cell 2} |',
  },
  {
    prefix: 'link',
    label: 'Markdown Link',
    description: 'Inline link',
    body: '[${1:text}](${2:url})',
  },
  {
    prefix: 'img',
    label: 'Image',
    description: 'Markdown image',
    body: '![${1:alt text}](${2:url})',
  },
] as const;

// =============================================================================
// Completion Source
// =============================================================================

/**
 * Build a CodeMirror completion from a snippet definition.
 */
function snippetToCompletion(s: Snippet): Completion {
  const completion: Completion = {
    label: s.prefix,
    displayLabel: s.label,
    type: 'snippet',
    apply: snippet(s.body),
    boost: 1,
  };

  if (s.description) {
    completion.detail = s.description;
  }

  return completion;
}

/**
 * Create a completion source from a list of snippets.
 */
function createSnippetSource(
  snippets: readonly Snippet[]
): (context: CompletionContext) => CompletionResult | null {
  const completions = snippets.map(snippetToCompletion);

  return (context: CompletionContext): CompletionResult | null => {
    // Match word characters before cursor
    const word = context.matchBefore(/\w+/);
    if (!word && !context.explicit) return null;

    return {
      from: word?.from ?? context.pos,
      options: completions,
      validFor: /^\w*$/,
    };
  };
}

// =============================================================================
// Extension
// =============================================================================

/**
 * Snippet engine extension for CodeMirror.
 *
 * Provides autocomplete-driven snippet expansion with tab-stop navigation.
 * Includes built-in MDX snippets and supports custom snippets.
 *
 * @param customSnippets - Additional custom snippets to include
 * @returns CodeMirror Extension
 *
 * @example
 * ```typescript
 * import { snippetExtension, MDX_SNIPPETS } from './snippets-engine';
 *
 * // Use with default MDX snippets only
 * const ext = snippetExtension();
 *
 * // Add custom snippets
 * const ext = snippetExtension([
 *   { prefix: 'hero', label: 'Hero Section', body: '<Hero title="${1:title}" />' },
 * ]);
 * ```
 */
export function snippetExtension(customSnippets: Snippet[] = []): Extension {
  const allSnippets = [...MDX_SNIPPETS, ...customSnippets];

  return autocompletion({
    override: [createSnippetSource(allSnippets)],
  });
}
