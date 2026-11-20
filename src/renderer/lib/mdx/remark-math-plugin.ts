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

import { isCurrencySpan } from '@shared/lib/currency-span';
import { PREVIEW_DOLLAR } from '@shared/lib/preview-math-dollars';
import { katexMathTex, renderableMathTex } from '@shared/lib/renderable-math';

import type { MdxPluginDefinition, MdxPipelinePlugin } from './plugin-pipeline';

interface TreeNode {
  type: string;
  value?: string;
  url?: string;
  title?: string | null;
  identifier?: string;
  label?: string;
  alt?: string | null;
  children?: TreeNode[];
}

const DOLLAR_FIELDS = ['value', 'url', 'title', 'identifier', 'label', 'alt'] as const;

function restorePreviewDollars(node: TreeNode): void {
  for (const field of DOLLAR_FIELDS) {
    const current = node[field];
    if (typeof current === 'string' && current.includes(PREVIEW_DOLLAR)) {
      node[field] = current.replaceAll(PREVIEW_DOLLAR, '$');
    }
  }
  for (const child of node.children ?? []) {
    restorePreviewDollars(child);
  }
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
      isCurrencySpan(child.value)
    ) {
      children.splice(index, 1, { type: 'text', value: `$${child.value}$` });
      continue;
    }
    if (
      (child.type === 'inlineMath' || child.type === 'math') &&
      typeof child.value === 'string'
    ) {
      child.value = katexMathTex(renderableMathTex(child.value));
    }
    unwrapCurrencyMath(child);
  }
}

const remarkMathGuarded: Plugin = function remarkMathGuardedPlugin() {
  remarkMath.call(this);
  return (tree: TreeNode) => {
    unwrapCurrencyMath(tree);
    restorePreviewDollars(tree);
  };
};

export const remarkMathPluginDefinition: MdxPluginDefinition = {
  name: 'remark-math',
  kind: 'remark',
  enabledByDefault: true,
  create: () => remarkMathGuarded as MdxPipelinePlugin,
};
