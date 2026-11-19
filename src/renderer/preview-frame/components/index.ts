/**
 * Component Registry
 *
 * Exports BuiltInComponents map for MDX provider.
 * Combines all built-in components into a single object.
 * @module preview-frame/components
 */

import { previewMediaComponents } from './preview-media';
import { typographyComponents } from './typography';
import { Callout } from './Callout';
import { CodeBlock } from './CodeBlock';
import { Tabs, Tab } from './Tabs';
import { Card, CardGrid } from './Card';
import { FileTree } from './FileTree';
import { ErrorBoundary } from './ErrorBoundary';

/** Built-in components available in all MDX documents */
export const BuiltInComponents = {
  // Typography (MDX overrides for standard elements)
  ...typographyComponents,
  ...previewMediaComponents,

  // Custom components
  Callout,
  CodeBlock,
  Tabs,
  Tab,
  Card,
  CardGrid,
  FileTree,

  // Fenced code blocks render as <pre><code> in compiled MDX.
  // Override only <pre> so inline <code> remains inline text.
  pre: CodeBlock,
} as const;

// Re-export individual components for direct use
export {
  Callout,
  CodeBlock,
  Tabs,
  Tab,
  Card,
  CardGrid,
  FileTree,
  ErrorBoundary,
  typographyComponents,
};

// Type for the components map
export type BuiltInComponentsType = typeof BuiltInComponents;
