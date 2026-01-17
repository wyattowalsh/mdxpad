/**
 * StatusBar Component Types
 *
 * Type definitions for StatusBar and its subcomponents.
 * Imports CompilationError from shell-schemas contract.
 *
 * @module renderer/components/shell/StatusBar/types
 */

import type { CompilationError } from '../../../../../.specify/specs/006-application-shell/contracts/shell-schemas';

// Re-export for convenience
export type { CompilationError };

/**
 * Props for the FileInfo component.
 * Displays filename with optional dirty/orphan indicators.
 */
export interface FileInfoProps {
  /** Name of the current file */
  readonly fileName: string;
  /** Whether the file has unsaved changes */
  readonly isDirty: boolean;
  /** Whether the file was deleted externally */
  readonly isOrphan?: boolean;
}

/**
 * Props for the CursorPosition component.
 * Displays current line and column position.
 */
export interface CursorPositionProps {
  /** Current line number (1-indexed) */
  readonly line: number;
  /** Current column number (1-indexed) */
  readonly column: number;
}

/**
 * Props for the ErrorCount component.
 * Displays error count with popover for details.
 */
export interface ErrorCountProps {
  /** Array of compilation errors */
  readonly errors: readonly CompilationError[];
  /** Callback when user clicks on an error to navigate */
  readonly onErrorClick: (error: CompilationError) => void;
}

/**
 * Props for the StatusBar container component.
 * Combines all subcomponent props.
 */
export interface StatusBarProps {
  /** Name of the current file */
  readonly fileName: string;
  /** Whether the file has unsaved changes */
  readonly isDirty: boolean;
  /** Whether the file was deleted externally */
  readonly isOrphan?: boolean;
  /** Current line number (1-indexed) */
  readonly line: number;
  /** Current column number (1-indexed) */
  readonly column: number;
  /** Array of compilation errors */
  readonly errors: readonly CompilationError[];
  /** Callback when user clicks on an error to navigate */
  readonly onErrorClick: (error: CompilationError) => void;
}
