/**
 * Rehype KaTeX Plugin
 *
 * Provides rehype-katex integration for rendering math nodes to HTML
 * using KaTeX. Supports inline and display modes with error handling.
 *
 * @module renderer/lib/mdx/rehype-katex-plugin
 */

import rehypeKatex from 'rehype-katex';
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

export const rehypeKatexPluginDefinition: MdxPluginDefinition<KatexOptions> = {
  name: 'rehype-katex',
  kind: 'rehype',
  enabledByDefault: false,
  defaultOptions: DEFAULT_KATEX_OPTIONS,
  optionsSchema: katexOptionsSchema,
  create: (_context, options) => {
    const resolvedOptions = options ?? DEFAULT_KATEX_OPTIONS;
    if (Object.keys(resolvedOptions).length === 0) {
      return rehypeKatex as MdxPipelinePlugin;
    }
    return [rehypeKatex as (...args: readonly unknown[]) => unknown, resolvedOptions] as const;
  },
};
