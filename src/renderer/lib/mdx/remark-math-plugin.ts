/**
 * Remark Math Plugin
 *
 * Provides remark-math integration for detecting inline ($...$) and
 * display ($$...$$) math syntax in MDX content.
 *
 * @module renderer/lib/mdx/remark-math-plugin
 */

import remarkMath from 'remark-math';
import type { MdxPluginDefinition, MdxPipelinePlugin } from './plugin-pipeline';

export const remarkMathPluginDefinition: MdxPluginDefinition = {
  name: 'remark-math',
  kind: 'remark',
  enabledByDefault: false,
  create: () => remarkMath as MdxPipelinePlugin,
};
