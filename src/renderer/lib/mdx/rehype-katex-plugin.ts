/**
 * Rehype KaTeX Plugin
 *
 * Provides rehype-katex integration for rendering math nodes to HTML
 * using KaTeX. Supports inline and display modes with error handling.
 *
 * @module renderer/lib/mdx/rehype-katex-plugin
 */

import { z } from 'zod';
import type { MdxPluginDefinition, MdxPipelinePlugin } from './plugin-pipeline';

const katexOptionsSchema = z
  .object({
    output: z.enum(['html', 'mathml', 'htmlAndMathml']).optional(),
    throwOnError: z.boolean().optional(),
    errorColor: z.string().optional(),
    macros: z.record(z.string()).optional(),
    strict: z.union([z.boolean(), z.enum(['warn', 'ignore', 'error'])]).optional(),
    trust: z.boolean().optional(),
    maxSize: z.number().optional(),
    maxExpand: z.number().optional(),
    displayMode: z.boolean().optional(),
    fleqn: z.boolean().optional(),
    leqno: z.boolean().optional(),
    minRuleThickness: z.number().optional(),
  })
  .strict();

type KatexOptions = z.infer<typeof katexOptionsSchema>;

const DEFAULT_KATEX_OPTIONS: KatexOptions = {
  throwOnError: false,
  errorColor: '#cc0000',
  strict: 'ignore',
};

type RehypeKatexTransformer = (tree: unknown, file: unknown) => unknown;
type RehypeKatexFactory = (options: KatexOptions | undefined) => RehypeKatexTransformer | undefined;
interface HastNodeLike {
  readonly type?: unknown;
  readonly properties?: { readonly className?: unknown } | undefined;
  readonly children?: unknown;
}

const MATH_CLASS_TOKENS = new Set(['math-inline', 'math-display', 'language-math']);

function hasMathClassName(className: unknown): boolean {
  if (typeof className === 'string') {
    return className.split(/\s+/u).some((token) => MATH_CLASS_TOKENS.has(token));
  }

  if (Array.isArray(className)) {
    return className.some((token) => typeof token === 'string' && MATH_CLASS_TOKENS.has(token));
  }

  return false;
}

function containsMathNodes(tree: unknown): boolean {
  const stack: unknown[] = [tree];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      continue;
    }

    const node = current as HastNodeLike;
    if (node.type === 'element' && hasMathClassName(node.properties?.className)) {
      return true;
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        stack.push(child);
      }
    }
  }

  return false;
}

function createDeferredKatexPlugin(options: KatexOptions | undefined): MdxPipelinePlugin {
  return () => {
    let transformerPromise: Promise<RehypeKatexTransformer> | null = null;

    const loadTransformer = async (): Promise<RehypeKatexTransformer> => {
      const module = (await import('rehype-katex')) as { default: RehypeKatexFactory };
      const transformer = module.default(options);
      if (typeof transformer === 'function') {
        return transformer;
      }
      return () => undefined;
    };

    return async (tree: unknown, file: unknown): Promise<void> => {
      if (!containsMathNodes(tree)) {
        return;
      }
      transformerPromise ??= loadTransformer();
      const transformer = await transformerPromise;
      await Promise.resolve(transformer(tree, file));
    };
  };
}

export const rehypeKatexPluginDefinition: MdxPluginDefinition<KatexOptions> = {
  name: 'rehype-katex',
  kind: 'rehype',
  enabledByDefault: true,
  defaultOptions: DEFAULT_KATEX_OPTIONS,
  optionsSchema: katexOptionsSchema,
  create: (_context, options) => {
    const resolvedOptions = options ?? DEFAULT_KATEX_OPTIONS;
    const normalizedOptions =
      Object.keys(resolvedOptions).length === 0 ? undefined : resolvedOptions;
    return createDeferredKatexPlugin(normalizedOptions);
  },
};
