/**
 * Math Plugins
 *
 * Combined export for math-related MDX plugins.
 * Provides remark-math for syntax detection and rehype-katex for rendering.
 *
 * @module renderer/lib/mdx/math-plugins
 */

import { remarkMathPluginDefinition } from './remark-math-plugin';
import { rehypeKatexPluginDefinition } from './rehype-katex-plugin';

/**
 * Get remark plugins for math support.
 * Returns the remark-math plugin definition for inline/display math detection.
 */
export function getMathRemarkPlugins() {
  return [remarkMathPluginDefinition] as const;
}

/**
 * Get rehype plugins for math rendering.
 * Returns the rehype-katex plugin definition for KaTeX rendering.
 */
export function getMathRehypePlugins() {
  return [rehypeKatexPluginDefinition] as const;
}
