/**
 * Editor component exports.
 *
 * @module components/editor
 */

export { MDXEditor, type MDXEditorProps, type EditorTheme } from './MDXEditor';
export type { EditorError, EditorErrorType } from '../../lib/editor/errors';
export { isSyntaxError, isCommandError, isExtensionError } from '../../lib/editor/errors';
export { EDITOR_COMMANDS } from '../../hooks/useCodeMirror';
export type { EditorCommandName, EditorCommandDefinition } from '../../hooks/useCodeMirror';
