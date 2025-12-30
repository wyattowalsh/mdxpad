/**
 * Editor type definitions.
 * Opaque wrappers for CodeMirror types to enable type-safe editor operations.
 */

/** Opaque wrapper for CodeMirror EditorState */
export interface EditorState {
  readonly doc: string;
  readonly selection: Selection;
}

/** Selection range within the document */
export interface Selection {
  readonly anchor: number;
  readonly head: number;
}

/** Computed selection properties */
export interface SelectionInfo {
  readonly from: number;
  readonly to: number;
  readonly empty: boolean;
}

/** Editor command signature */
export type Command = (state: EditorState) => EditorState | null;

/** Editor configuration */
export interface EditorConfig {
  readonly initialDoc?: string;
  readonly readonly?: boolean;
  readonly lineNumbers?: boolean;
  readonly lineWrapping?: boolean;
  readonly tabSize?: number;
  readonly indentWithTabs?: boolean;
}

/** Editor change event payload */
export interface EditorChange {
  readonly fromA: number;
  readonly toA: number;
  readonly fromB: number;
  readonly toB: number;
  readonly inserted: string;
}
