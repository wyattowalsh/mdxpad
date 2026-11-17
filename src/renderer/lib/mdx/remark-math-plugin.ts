/**
 * Remark Math Plugin
 *
 * Provides remark-math integration for detecting inline ($...$) and
 * display ($$...$$) math syntax in MDX content.
 *
 * @module renderer/lib/mdx/remark-math-plugin
 */

import remarkMath from 'remark-math';
import type { Plugin } from 'unified';
import type { MdxPluginDefinition, MdxPipelinePlugin } from './plugin-pipeline';

interface TreeNode {
  type: string;
  value?: string;
  children?: TreeNode[];
}

function isCurrencyMath(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (/\d/.test(trimmed) && /^[\d\s.,:;]+$/.test(trimmed)) {
    return true;
  }
  // remark-math can treat "$5 and $10" as one span. A spaced word is a price phrase.
  // A formula such as "$a + b$" has no word and keeps its operators.
  return /\s/.test(value) && /[A-Za-z]{2,}/.test(trimmed) && !/[\\^_{}=+*/<>]/.test(value);
}

function unwrapCurrencyMath(tree: TreeNode): void {
  const children = tree.children;
  if (!children) {
    return;
  }
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const child = children[index];
    if (!child) {
      continue;
    }
    if (
      child.type === 'inlineMath' &&
      typeof child.value === 'string' &&
      isCurrencyMath(child.value)
    ) {
      children.splice(index, 1, { type: 'text', value: `$${child.value}$` });
      continue;
    }
    unwrapCurrencyMath(child);
  }
}

const remarkMathGuarded: Plugin = function remarkMathGuardedPlugin() {
  remarkMath.call(this);
  return (tree: TreeNode) => {
    unwrapCurrencyMath(tree);
  };
};

export const remarkMathPluginDefinition: MdxPluginDefinition = {
  name: 'remark-math',
  kind: 'remark',
  enabledByDefault: true,
  create: () => remarkMathGuarded as MdxPipelinePlugin,
};
