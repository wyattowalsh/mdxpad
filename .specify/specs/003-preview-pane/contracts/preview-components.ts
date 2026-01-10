/**
 * Preview Components Contract
 *
 * Defines the interfaces for built-in MDX components provided by mdxpad.
 * These components are registered in the preview iframe and available
 * for use in MDX documents.
 *
 * @module contracts/preview-components
 */

import type { ReactNode } from 'react';

// ============================================================================
// Typography Components (FR-009)
// ============================================================================

/**
 * Typography component mappings for MDX.
 * These map HTML elements to styled React components.
 */
export interface TypographyComponents {
  h1: React.ComponentType<{ children: ReactNode }>;
  h2: React.ComponentType<{ children: ReactNode }>;
  h3: React.ComponentType<{ children: ReactNode }>;
  h4: React.ComponentType<{ children: ReactNode }>;
  h5: React.ComponentType<{ children: ReactNode }>;
  h6: React.ComponentType<{ children: ReactNode }>;
  p: React.ComponentType<{ children: ReactNode }>;
  a: React.ComponentType<{ href?: string; children: ReactNode }>;
  ul: React.ComponentType<{ children: ReactNode }>;
  ol: React.ComponentType<{ children: ReactNode }>;
  li: React.ComponentType<{ children: ReactNode }>;
  blockquote: React.ComponentType<{ children: ReactNode }>;
  hr: React.ComponentType<Record<string, never>>;
  table: React.ComponentType<{ children: ReactNode }>;
  thead: React.ComponentType<{ children: ReactNode }>;
  tbody: React.ComponentType<{ children: ReactNode }>;
  tr: React.ComponentType<{ children: ReactNode }>;
  th: React.ComponentType<{ children: ReactNode }>;
  td: React.ComponentType<{ children: ReactNode }>;
}

// ============================================================================
// CodeBlock Component (FR-010)
// ============================================================================

/**
 * Props for the CodeBlock component.
 * Provides syntax-highlighted code display with copy functionality.
 */
export interface CodeBlockProps {
  /**
   * Code content to display.
   * Passed as children from MDX code fence.
   */
  readonly children: string;

  /**
   * Language class from highlight.js.
   * Format: "language-{lang}" (e.g., "language-typescript").
   */
  readonly className?: string;

  /**
   * Optional title displayed above the code block.
   * Can be specified via meta string: ```ts title="example.ts"
   */
  readonly title?: string;

  /**
   * Whether to show line numbers.
   * Can be specified via meta string: ```ts showLineNumbers
   */
  readonly showLineNumbers?: boolean;
}

/**
 * CodeBlock component contract.
 */
export interface CodeBlockComponent {
  (props: CodeBlockProps): JSX.Element;
}

// ============================================================================
// Callout Component (FR-011)
// ============================================================================

/**
 * Callout variant types.
 * Each variant has distinct styling (icon, color).
 */
export type CalloutType =
  | 'info'
  | 'warning'
  | 'error'
  | 'success'
  | 'note'
  | 'tip';

/**
 * Props for the Callout component.
 * Displays highlighted information boxes.
 */
export interface CalloutProps {
  /**
   * Callout variant determining styling.
   * @default 'info'
   */
  readonly type?: CalloutType;

  /**
   * Optional title for the callout.
   * If omitted, uses default title for the type.
   */
  readonly title?: string;

  /** Callout content */
  readonly children: ReactNode;
}

/**
 * Callout component contract.
 */
export interface CalloutComponent {
  (props: CalloutProps): JSX.Element;
}

// ============================================================================
// Tabs Components (FR-012)
// ============================================================================

/**
 * Props for the Tabs container component.
 */
export interface TabsProps {
  /**
   * Initial active tab value.
   * If omitted, first tab is active.
   */
  readonly defaultValue?: string;

  /** Tab components */
  readonly children: ReactNode;
}

/**
 * Props for individual Tab component.
 */
export interface TabProps {
  /**
   * Unique value identifying this tab.
   * Used for selection state.
   */
  readonly value: string;

  /**
   * Tab label displayed in tab list.
   */
  readonly label: string;

  /** Tab panel content */
  readonly children: ReactNode;
}

/**
 * Tabs component contract.
 */
export interface TabsComponent {
  (props: TabsProps): JSX.Element;
}

/**
 * Tab component contract.
 */
export interface TabComponent {
  (props: TabProps): JSX.Element;
}

// ============================================================================
// Card Components (FR-013)
// ============================================================================

/**
 * Props for the Card component.
 */
export interface CardProps {
  /**
   * Card title.
   */
  readonly title: string;

  /**
   * Optional link URL.
   * If provided, entire card is clickable.
   */
  readonly href?: string;

  /**
   * Optional icon element.
   */
  readonly icon?: ReactNode;

  /**
   * Optional card description/content.
   */
  readonly children?: ReactNode;
}

/**
 * Props for the CardGrid component.
 */
export interface CardGridProps {
  /**
   * Number of columns in the grid.
   * @default 2
   */
  readonly columns?: 2 | 3 | 4;

  /** Card components */
  readonly children: ReactNode;
}

/**
 * Card component contract.
 */
export interface CardComponent {
  (props: CardProps): JSX.Element;
}

/**
 * CardGrid component contract.
 */
export interface CardGridComponent {
  (props: CardGridProps): JSX.Element;
}

// ============================================================================
// FileTree Component (FR-014)
// ============================================================================

/**
 * Node in a file tree structure.
 */
export interface FileTreeNode {
  /** File or directory name */
  readonly name: string;

  /** Node type */
  readonly type: 'file' | 'directory';

  /**
   * Child nodes (directories only).
   */
  readonly children?: FileTreeNode[];
}

/**
 * Props for the FileTree component.
 */
export interface FileTreeProps {
  /**
   * Tree data structure.
   */
  readonly data: FileTreeNode[];
}

/**
 * FileTree component contract.
 */
export interface FileTreeComponent {
  (props: FileTreeProps): JSX.Element;
}

// ============================================================================
// Component Registry
// ============================================================================

/**
 * Complete registry of built-in MDX components.
 * This is the component map passed to MDX runtime.
 */
export interface BuiltInComponents extends TypographyComponents {
  // Block components
  code: CodeBlockComponent;
  pre: React.ComponentType<{ children: ReactNode }>;

  // Custom components
  Callout: CalloutComponent;
  CodeBlock: CodeBlockComponent;
  Tabs: TabsComponent;
  Tab: TabComponent;
  Card: CardComponent;
  CardGrid: CardGridComponent;
  FileTree: FileTreeComponent;
}

/**
 * Creates the default component registry.
 * Used by preview iframe renderer.
 */
export type ComponentRegistry = Readonly<BuiltInComponents>;
