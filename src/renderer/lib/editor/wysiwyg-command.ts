import { redo, undo } from 'prosemirror-history';
import { setBlockType, toggleMark } from 'prosemirror-commands';
import type { EditorView } from 'prosemirror-view';

import { mdxSchema } from './prosemirror-mdx-schema';
import { insertWysiwygLink } from './wysiwyg-document';
import { insertMarkdownBlock } from './wysiwyg-insert';
import { focusSourceLineInView } from './wysiwyg-source-line';
import { findFromPrompt, replaceFromPrompt } from './wysiwyg-find';

export const VISUAL_EDIT_COMMANDS = [
  'bold',
  'italic',
  'code',
  'link',
  'codeBlock',
  'undo',
  'redo',
  'heading1',
  'heading2',
  'heading3',
  'goToLine',
  'find',
  'findReplace',
] as const;

export type VisualEditCommand = (typeof VISUAL_EDIT_COMMANDS)[number];

let runEdit: ((command: VisualEditCommand) => boolean) | null = null;

/** The visual editor registers this while it is on screen. */
export function registerWysiwygEdit(run: ((command: VisualEditCommand) => boolean) | null): void {
  runEdit = run;
}

export function hasWysiwygEdit(): boolean {
  return runEdit !== null;
}

/** Run a formatting command in the visual editor. */
export function runWysiwygEdit(command: VisualEditCommand): boolean {
  return runEdit?.(command) ?? false;
}

export function isVisualEditCommand(command: string): command is VisualEditCommand {
  return (VISUAL_EDIT_COMMANDS as readonly string[]).includes(command);
}

function headingLevel(command: VisualEditCommand): number | null {
  switch (command) {
    case 'heading1':
      return 1;
    case 'heading2':
      return 2;
    case 'heading3':
      return 3;
    case 'bold':
    case 'italic':
    case 'code':
    case 'link':
    case 'codeBlock':
    case 'undo':
    case 'redo':
    case 'goToLine':
    case 'find':
    case 'findReplace':
      return null;
    default: {
      const unreachable: never = command;
      return unreachable;
    }
  }
}

function goToRequestedLine(view: EditorView): boolean {
  const raw = globalThis.prompt('Go to line:');
  const line = Number(raw);
  if (!raw || !Number.isInteger(line) || line < 1) {
    view.focus();
    return true;
  }
  return focusSourceLineInView(view, line, 1);
}

/** Apply a palette formatting command to the visual editor. */
export function applyVisualEdit(view: EditorView, command: VisualEditCommand): boolean {
  const level = headingLevel(command);
  if (level !== null) {
    setBlockType(mdxSchema.nodes.heading, { level })(view.state, view.dispatch);
    view.focus();
    return true;
  }
  switch (command) {
    case 'bold':
    case 'italic':
    case 'code':
      toggleMark(mdxSchema.marks[command])(view.state, view.dispatch);
      view.focus();
      return true;
    case 'link': {
      const href = globalThis.prompt('Enter URL:');
      if (href) {
        insertWysiwygLink(view, href);
      }
      view.focus();
      return true;
    }
    case 'codeBlock':
      return insertMarkdownBlock(view, '```\n\n```');
    case 'undo':
      undo(view.state, view.dispatch);
      view.focus();
      return true;
    case 'redo':
      redo(view.state, view.dispatch);
      view.focus();
      return true;
    case 'goToLine':
      return goToRequestedLine(view);
    case 'find':
      return findFromPrompt(view);
    case 'findReplace':
      return replaceFromPrompt(view);
    case 'heading1':
    case 'heading2':
    case 'heading3':
      return true;
    default: {
      const unreachable: never = command;
      return unreachable;
    }
  }
}
