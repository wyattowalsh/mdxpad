/**
 * CodeMirror React Integration Module
 *
 * This module provides React hooks and utilities for integrating CodeMirror 6
 * with React applications. It serves as the primary API for editor functionality.
 *
 * @module useCodeMirror
 *
 * ## Primary Export
 * - `useCodeMirror` - React hook for creating and managing a CodeMirror editor instance
 *
 * ## Types
 * - `UseCodeMirrorOptions` - Configuration options for the hook
 * - `UseCodeMirrorReturn` - Return type with refs, state, and control methods
 * - `EditorTheme` - Theme options ('light' | 'dark' | 'system')
 * - `EditorState` - Read-only snapshot of editor state
 * - `SelectionInfo` - Selection/cursor position information
 * - `EditorError` - Structured error information
 * - `EditorCommandName` - Available command names
 *
 * ## Utilities
 * - `EDITOR_COMMANDS` - Array of command definitions for toolbar building
 * - `isSyntaxError`, `isCommandError`, `isExtensionError` - Type guards
 *
 * @example
 * ```tsx
 * import { useCodeMirror, EditorState } from './hooks/useCodeMirror';
 *
 * function Editor() {
 *   const { containerRef, state, setValue } = useCodeMirror({
 *     initialDoc: '# Hello',
 *     theme: 'dark',
 *   });
 *   return <div ref={containerRef} />;
 * }
 * ```
 */

export { useCodeMirror } from './useCodeMirror';
export type { UseCodeMirrorReturn, UseCodeMirrorOptions } from './useCodeMirror';
export { EDITOR_COMMANDS } from './commands';
export type { EditorCommandName, EditorCommandDefinition, OnErrorCallback } from './commands';
export type { EditorTheme } from './themes';
export type { EditorError, EditorErrorType } from './useCodeMirror';
export { isSyntaxError, isCommandError, isExtensionError } from './useCodeMirror';
export type { EditorState, SelectionInfo } from './useCodeMirror';
