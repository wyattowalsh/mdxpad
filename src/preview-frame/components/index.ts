/**
 * Component Registry
 *
 * Exports BuiltInComponents map for MDX provider.
 * Combines all built-in components into a single object.
 * @module preview-frame/components
 */

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

  // Custom components
  Callout,
  CodeBlock,
  Tabs,
  Tab,
  Card,
  CardGrid,
  FileTree,

  // Code block alias (for fenced code blocks)
  pre: CodeBlock,
  code: CodeBlock,
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
