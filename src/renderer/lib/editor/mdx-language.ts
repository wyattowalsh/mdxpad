/**
 * MDX Language Support for CodeMirror 6
 *
 * Provides MDX syntax highlighting with:
 * - YAML frontmatter support (between --- delimiters)
 * - Markdown base language
 * - JSX/TypeScript highlighting in code blocks and expressions
 * - Language-specific highlighting for fenced code blocks
 *
 * @module mdx-language
 */

import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { languages } from '@codemirror/language-data';
import { yamlFrontmatter } from '@codemirror/lang-yaml';
import type { LanguageSupport } from '@codemirror/language';

/**
 * Creates MDX language support with YAML frontmatter, Markdown, and JSX highlighting.
 *
 * This function configures CodeMirror to handle MDX files by combining:
 * - YAML frontmatter parsing for metadata between `---` delimiters
 * - Markdown language support as the base
 * - JavaScript/JSX/TypeScript for inline expressions and code blocks
 * - Automatic language detection for fenced code blocks
 * - HTML tag completion support
 *
 * Per Constitution Article III Section 3.4 - CodeMirror idioms.
 *
 * @returns LanguageSupport extension for MDX documents
 *
 * @example
 * ```typescript
 * import { EditorState } from '@codemirror/state';
 * import { EditorView } from '@codemirror/view';
 * import { mdxLanguage } from './mdx-language';
 *
 * const state = EditorState.create({
 *   doc: '---\ntitle: Hello\n---\n\n# Welcome\n\n<MyComponent />',
 *   extensions: [mdxLanguage()],
 * });
 * ```
 */
export function mdxLanguage(): LanguageSupport {
  const mdx = markdown({
    base: markdownLanguage,
    defaultCodeLanguage: javascript({ jsx: true, typescript: true }),
    codeLanguages: languages,
    completeHTMLTags: true,
  });

  return yamlFrontmatter({
    content: mdx,
  });
}
