/**
 * Math Plugins Tests
 *
 * Tests for math plugin definitions and combined export functions.
 *
 * @module renderer/lib/mdx/math-plugins.test
 */

import { describe, it, expect } from 'vitest';
import { getMathRemarkPlugins, getMathRehypePlugins } from './math-plugins';
import { remarkMathPluginDefinition } from './remark-math-plugin';
import { rehypeKatexPluginDefinition } from './rehype-katex-plugin';

describe('getMathRemarkPlugins', () => {
  it('should return an array with the remark-math plugin definition', () => {
    const plugins = getMathRemarkPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toBe(remarkMathPluginDefinition);
  });
});

describe('getMathRehypePlugins', () => {
  it('should return an array with the rehype-katex plugin definition', () => {
    const plugins = getMathRehypePlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toBe(rehypeKatexPluginDefinition);
  });
});

describe('remarkMathPluginDefinition', () => {
  it('should have correct name and kind', () => {
    expect(remarkMathPluginDefinition.name).toBe('remark-math');
    expect(remarkMathPluginDefinition.kind).toBe('remark');
  });

  it('should be enabled by default', () => {
    expect(remarkMathPluginDefinition.enabledByDefault).toBe(true);
  });

  it('should create a plugin function', () => {
    const context = { frontmatter: {}, setOutline: () => {} };
    const plugin = remarkMathPluginDefinition.create(context, undefined);
    expect(typeof plugin).toBe('function');
  });
});

describe('rehypeKatexPluginDefinition', () => {
  it('should have correct name and kind', () => {
    expect(rehypeKatexPluginDefinition.name).toBe('rehype-katex');
    expect(rehypeKatexPluginDefinition.kind).toBe('rehype');
  });

  it('should be enabled by default', () => {
    expect(rehypeKatexPluginDefinition.enabledByDefault).toBe(true);
  });

  it('should create a plugin with default options', () => {
    const context = { frontmatter: {}, setOutline: () => {} };
    const plugin = rehypeKatexPluginDefinition.create(context, undefined);
    expect(typeof plugin).toBe('function');
  });

  it('should create a plugin with custom options', () => {
    const context = { frontmatter: {}, setOutline: () => {} };
    const plugin = rehypeKatexPluginDefinition.create(context, {
      throwOnError: true,
    });
    expect(typeof plugin).toBe('function');
  });
});
