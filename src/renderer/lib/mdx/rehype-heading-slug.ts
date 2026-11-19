import { allocateHeadingSlug, normalizedHeadingFragment } from '@shared/lib/markdown-heading';
import type { MdxPluginDefinition, MdxPipelinePlugin } from './plugin-pipeline';

interface HastNode {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

function isHeadingTag(tagName: string | undefined): boolean {
  return (
    tagName === 'h1' ||
    tagName === 'h2' ||
    tagName === 'h3' ||
    tagName === 'h4' ||
    tagName === 'h5' ||
    tagName === 'h6'
  );
}

function headingText(node: HastNode): string {
  if (node.type === 'text') {
    return node.value ?? '';
  }
  return (node.children ?? []).map((child) => headingText(child)).join('');
}

function assignHeadingIds(node: HastNode, counts: Map<string, number>): void {
  if (node.type === 'element' && isHeadingTag(node.tagName)) {
    const properties = node.properties ?? {};
    if (typeof properties.id !== 'string' || properties.id.length === 0) {
      properties.id = allocateHeadingSlug(headingText(node), counts);
      node.properties = properties;
    }
  }
  for (const child of node.children ?? []) {
    assignHeadingIds(child, counts);
  }
}

function rewriteHeadingLinks(node: HastNode): void {
  if (node.type === 'element' && node.tagName === 'a') {
    const properties = node.properties ?? {};
    const href = properties.href;
    if (typeof href === 'string') {
      const slug = normalizedHeadingFragment(href);
      if (slug) {
        properties.href = `#${slug}`;
        node.properties = properties;
      }
    }
  }
  for (const child of node.children ?? []) {
    rewriteHeadingLinks(child);
  }
}

function slugHeadingTree(tree: unknown): void {
  if (!tree || typeof tree !== 'object') {
    return;
  }
  const root = tree as HastNode;
  assignHeadingIds(root, new Map<string, number>());
  rewriteHeadingLinks(root);
}

export const rehypeHeadingSlugPluginDefinition: MdxPluginDefinition = {
  name: 'rehype-heading-slug',
  kind: 'rehype',
  enabledByDefault: true,
  create: (): MdxPipelinePlugin => () => slugHeadingTree,
};
