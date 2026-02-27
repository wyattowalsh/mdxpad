import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { RequestId } from '@shared/types/preview-worker';
import { compileMdx } from './compile';
import {
  createMdxPluginRegistry,
  createDefaultMdxPluginRegistry,
  normalizeMdxPluginPipelineConfig,
} from './plugin-pipeline';

const testId = (id: string): RequestId => id as RequestId;

describe('mdx plugin pipeline', () => {
  it('registers a custom plugin and includes it when enabled', () => {
    const registry = createMdxPluginRegistry();
    registry.register({
      name: 'remark-test',
      kind: 'remark',
      enabledByDefault: false,
      create: () => () => {},
    });

    const pipeline = registry.createPipeline(
      { plugins: { 'remark-test': { enabled: true } } },
      { frontmatter: {}, setOutline: () => undefined }
    );

    expect(pipeline.remarkPlugins).toHaveLength(1);
    expect(pipeline.rehypePlugins).toHaveLength(0);
  });

  it('applies registered remark plugins during compilation', async () => {
    const registry = createDefaultMdxPluginRegistry();
    registry.register({
      name: 'remark-append-test-paragraph',
      kind: 'remark',
      enabledByDefault: false,
      create: () => () => (tree: unknown) => {
        const root = tree as { children: unknown[] };
        root.children.push({
          type: 'paragraph',
          children: [{ type: 'text', value: 'Injected by custom plugin' }],
        });
      },
    });

    const result = await compileMdx(testId('plugin-compile'), '# Title', {
      pluginRegistry: registry,
      pluginConfig: {
        plugins: {
          'remark-append-test-paragraph': { enabled: true },
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('Injected by custom plugin');
    }
  });

  it('uses default plugin options when option validation fails', async () => {
    const registry = createDefaultMdxPluginRegistry();
    registry.register<{ marker: string }>({
      name: 'remark-option-test',
      kind: 'remark',
      enabledByDefault: false,
      defaultOptions: { marker: 'default-marker' },
      optionsSchema: z.object({ marker: z.string() }).strict(),
      create: (_context, options) => () => (tree: unknown) => {
        const root = tree as { children: unknown[] };
        root.children.push({
          type: 'paragraph',
          children: [{ type: 'text', value: options?.marker ?? '' }],
        });
      },
    });

    const result = await compileMdx(testId('plugin-options'), '# Heading', {
      pluginRegistry: registry,
      pluginConfig: {
        plugins: {
          'remark-option-test': {
            enabled: true,
            options: { marker: 123 },
          },
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('default-marker');
    }
  });

  it('normalizes invalid pipeline config to safe defaults', () => {
    const normalized = normalizeMdxPluginPipelineConfig({
      plugins: {
        'rehype-highlight': { enabled: 'nope' },
      },
    });

    expect(normalized.plugins['rehype-highlight']?.enabled).toBe(true);
  });
});
