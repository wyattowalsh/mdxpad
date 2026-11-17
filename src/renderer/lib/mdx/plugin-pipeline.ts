import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import type { Root } from 'mdast';
import { z } from 'zod';
import type { OutlineAST } from '@shared/types/outline';
import { extractOutline } from './outline-extractor';
import { recordLocalTelemetryEvent } from '../telemetry/local-telemetry';
import { remarkMathPluginDefinition } from './remark-math-plugin';
import { rehypeKatexPluginDefinition } from './rehype-katex-plugin';
import { rehypeHeadingSlugPluginDefinition } from './rehype-heading-slug';

export type MdxPluginKind = 'remark' | 'rehype';

export interface MdxPluginContext {
  readonly frontmatter: Readonly<Record<string, unknown>>;
  setOutline: (outline: OutlineAST | null) => void;
}

export interface MdxPluginConfigEntry {
  readonly enabled?: boolean | undefined;
  readonly options?: unknown;
}

export interface MdxPluginPipelineConfig {
  readonly plugins?: Readonly<Record<string, MdxPluginConfigEntry>> | undefined;
}

interface NormalizedMdxPluginConfigEntry {
  readonly enabled: boolean;
  readonly options: unknown;
}

export interface NormalizedMdxPluginPipelineConfig {
  readonly plugins: Readonly<Record<string, NormalizedMdxPluginConfigEntry>>;
}

type MdxPipelinePluginFactory = (...args: readonly unknown[]) => unknown;
type MdxPipelinePluginTuple = readonly [MdxPipelinePluginFactory, ...(readonly unknown[])];
export type MdxPipelinePlugin = MdxPipelinePluginFactory | MdxPipelinePluginTuple;
export type MdxPipelinePluginList = MdxPipelinePlugin[];

export interface MdxPluginDefinition<TOptions = unknown> {
  readonly name: string;
  readonly kind: MdxPluginKind;
  readonly enabledByDefault?: boolean | undefined;
  readonly defaultOptions?: TOptions | undefined;
  readonly optionsSchema?: z.ZodType<TOptions> | undefined;
  readonly create: (context: MdxPluginContext, options: TOptions | undefined) => MdxPipelinePlugin;
}

const pluginConfigEntrySchema = z
  .object({
    enabled: z.boolean().optional(),
    options: z.unknown().optional(),
  })
  .strict();

const pluginPipelineConfigSchema = z
  .object({
    plugins: z.record(pluginConfigEntrySchema).optional(),
  })
  .strict();

const DEFAULT_PLUGIN_CONFIG: Readonly<Record<string, NormalizedMdxPluginConfigEntry>> =
  Object.freeze({
    'remark-gfm': { enabled: true, options: undefined },
    'remark-frontmatter': { enabled: true, options: undefined },
    'remark-outline': { enabled: true, options: undefined },
    'rehype-highlight': { enabled: true, options: undefined },
    'remark-math': { enabled: true, options: undefined },
    'rehype-katex': { enabled: true, options: undefined },
    'rehype-heading-slug': { enabled: true, options: undefined },
  });

type InternalPluginDefinition = MdxPluginDefinition;

function clonePluginConfig(
  config: Readonly<Record<string, NormalizedMdxPluginConfigEntry>>
): Record<string, NormalizedMdxPluginConfigEntry> {
  const cloned: Record<string, NormalizedMdxPluginConfigEntry> = {};
  for (const [name, entry] of Object.entries(config)) {
    cloned[name] = { enabled: entry.enabled, options: entry.options };
  }
  return cloned;
}

function buildDefaultConfig(
  plugins: Iterable<[string, InternalPluginDefinition]>
): Record<string, NormalizedMdxPluginConfigEntry> {
  const defaults: Record<string, NormalizedMdxPluginConfigEntry> = {};
  for (const [name, definition] of plugins) {
    defaults[name] = {
      enabled: definition.enabledByDefault ?? true,
      options: definition.defaultOptions,
    };
  }
  return defaults;
}

export function normalizeMdxPluginPipelineConfig(
  config: unknown,
  defaults: Readonly<Record<string, NormalizedMdxPluginConfigEntry>> = DEFAULT_PLUGIN_CONFIG
): NormalizedMdxPluginPipelineConfig {
  const baseline = clonePluginConfig(defaults);
  const parsed = pluginPipelineConfigSchema.safeParse(config);

  if (!parsed.success || parsed.data.plugins === undefined) {
    return { plugins: baseline };
  }

  for (const [name, pluginConfig] of Object.entries(parsed.data.plugins)) {
    const fallback = baseline[name];
    baseline[name] = {
      enabled: pluginConfig.enabled ?? fallback?.enabled ?? true,
      options: pluginConfig.options ?? fallback?.options,
    };
  }

  return { plugins: baseline };
}

export class MdxPluginRegistry {
  private readonly plugins = new Map<string, InternalPluginDefinition>();

  register<TOptions>(definition: MdxPluginDefinition<TOptions>): void {
    if (this.plugins.has(definition.name)) {
      recordLocalTelemetryEvent('plugin-pipeline', 'register-plugin', 'failed', {
        details: { plugin: definition.name },
      });
      throw new Error(`Plugin already registered: ${definition.name}`);
    }
    this.plugins.set(definition.name, definition as InternalPluginDefinition);
    recordLocalTelemetryEvent('plugin-pipeline', 'register-plugin', 'succeeded', {
      details: {
        plugin: definition.name,
        kind: definition.kind,
      },
    });
  }

  createPipeline(
    config: unknown,
    context: MdxPluginContext
  ): {
    remarkPlugins: MdxPipelinePluginList;
    rehypePlugins: MdxPipelinePluginList;
  } {
    recordLocalTelemetryEvent('plugin-pipeline', 'create-pipeline', 'started');
    try {
      const defaults = buildDefaultConfig(this.plugins);
      const normalized = normalizeMdxPluginPipelineConfig(config, defaults);
      const remarkPlugins: MdxPipelinePluginList = [];
      const rehypePlugins: MdxPipelinePluginList = [];

      for (const [name, definition] of this.plugins) {
        const pluginConfig = normalized.plugins[name];
        if (!pluginConfig?.enabled) {
          continue;
        }

        const options = this.resolvePluginOptions(definition, pluginConfig.options);
        const plugin = definition.create(context, options);
        if (definition.kind === 'remark') {
          remarkPlugins.push(plugin);
        } else {
          rehypePlugins.push(plugin);
        }
      }

      recordLocalTelemetryEvent('plugin-pipeline', 'create-pipeline', 'succeeded', {
        details: {
          remarkPluginCount: remarkPlugins.length,
          rehypePluginCount: rehypePlugins.length,
        },
      });

      return { remarkPlugins, rehypePlugins };
    } catch (error) {
      recordLocalTelemetryEvent('plugin-pipeline', 'create-pipeline', 'failed', {
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private resolvePluginOptions(
    definition: InternalPluginDefinition,
    configuredOptions: unknown
  ): unknown {
    if (configuredOptions === undefined) {
      return definition.defaultOptions;
    }
    if (!definition.optionsSchema) {
      return configuredOptions;
    }
    const parsed = definition.optionsSchema.safeParse(configuredOptions);
    if (!parsed.success) {
      recordLocalTelemetryEvent('plugin-pipeline', 'validate-plugin-options', 'failed', {
        details: {
          plugin: definition.name,
        },
      });
      return definition.defaultOptions;
    }
    return parsed.data;
  }
}

const highlightOptionsSchema = z
  .object({
    aliases: z.record(z.array(z.string())).optional(),
    detect: z.boolean().optional(),
    ignoreMissing: z.boolean().optional(),
    plainText: z.array(z.string()).optional(),
    prefix: z.string().optional(),
    subset: z.array(z.string()).optional(),
  })
  .strict();

type HighlightOptions = z.infer<typeof highlightOptionsSchema>;
type RehypeHighlightTransformer = (tree: unknown, file: unknown) => unknown;
type RehypeHighlightFactory = (
  options: HighlightOptions | undefined
) => RehypeHighlightTransformer | undefined;

interface HastNodeLike {
  readonly type?: unknown;
  readonly tagName?: unknown;
  readonly children?: unknown;
}

function containsCodeNodes(tree: unknown): boolean {
  const stack: unknown[] = [tree];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      continue;
    }

    const node = current as HastNodeLike;
    if (node.type === 'element' && node.tagName === 'code') {
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

function createDeferredHighlightPlugin(options: HighlightOptions | undefined): MdxPipelinePlugin {
  return () => {
    let transformerPromise: Promise<RehypeHighlightTransformer> | null = null;

    const loadTransformer = async (): Promise<RehypeHighlightTransformer> => {
      const module = (await import('rehype-highlight')) as { default: RehypeHighlightFactory };
      const transformer = module.default(options);
      if (typeof transformer === 'function') {
        return transformer;
      }
      return () => undefined;
    };

    return async (tree: unknown, file: unknown): Promise<void> => {
      if (!containsCodeNodes(tree)) {
        return;
      }
      transformerPromise ??= loadTransformer();
      const transformer = await transformerPromise;
      await Promise.resolve(transformer(tree, file));
    };
  };
}

function registerDefaultPlugins(registry: MdxPluginRegistry): MdxPluginRegistry {
  registry.register({
    name: 'remark-gfm',
    kind: 'remark',
    enabledByDefault: true,
    create: () => remarkGfm as MdxPipelinePluginFactory,
  });

  registry.register({
    name: 'remark-frontmatter',
    kind: 'remark',
    enabledByDefault: true,
    create: () => remarkFrontmatter as MdxPipelinePluginFactory,
  });

  registry.register({
    name: 'remark-outline',
    kind: 'remark',
    enabledByDefault: true,
    create:
      (context) =>
      () =>
      (tree: unknown): void => {
        context.setOutline(extractOutline(tree as Root, context.frontmatter));
      },
  });

  registry.register<HighlightOptions>({
    name: 'rehype-highlight',
    kind: 'rehype',
    enabledByDefault: true,
    defaultOptions: undefined,
    optionsSchema: highlightOptionsSchema,
    create: (_context, options) => {
      const normalizedOptions = !options || Object.keys(options).length === 0 ? undefined : options;
      return createDeferredHighlightPlugin(normalizedOptions);
    },
  });

  // Math plugins (Wave 2): remark-math for syntax detection, rehype-katex for rendering
  registry.register(remarkMathPluginDefinition);
  registry.register(rehypeKatexPluginDefinition);
  registry.register(rehypeHeadingSlugPluginDefinition);

  return registry;
}

export function createMdxPluginRegistry(): MdxPluginRegistry {
  return new MdxPluginRegistry();
}

export function createDefaultMdxPluginRegistry(): MdxPluginRegistry {
  return registerDefaultPlugins(createMdxPluginRegistry());
}
