import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { EditorView } from 'prosemirror-view';

import { BUILTIN_SLASH_COMMANDS, type SlashCommand } from './extensions/slash-command-definitions';
import { parseMdxContent } from './prosemirror-mdx-parser';

const SLASH_QUERY = /^\/(\w*)$/;
const slashKey = new PluginKey<SlashPluginState>('wysiwyg-slash');

interface SlashPluginState {
  readonly selected: number;
  readonly dismissed: string | null;
}

export interface SlashSession {
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly query: string;
  readonly commands: readonly SlashCommand[];
  readonly selected: number;
}

function paragraphText(state: EditorState): string {
  const parent = state.selection.$from.parent;
  return parent.isTextblock ? parent.textContent : '';
}

/** Commands whose name or label starts with the typed query. */
export function matchingSlashCommands(query: string): readonly SlashCommand[] {
  const needle = query.toLowerCase();
  return BUILTIN_SLASH_COMMANDS.filter((command) => {
    return (
      command.name.toLowerCase().startsWith(needle) ||
      command.label.toLowerCase().startsWith(needle)
    );
  });
}

/** The `/query` at the start of the current block, when the caret is at its end. */
export function slashSession(state: EditorState, selected = 0): SlashSession | null {
  const { selection } = state;
  const parent = selection.$from.parent;
  if (!selection.empty || !parent.isTextblock || selection.$from.parentOffset !== parent.content.size) {
    return null;
  }
  const match = SLASH_QUERY.exec(parent.textContent);
  const query = match?.[1];
  if (query === undefined) {
    return null;
  }
  const commands = matchingSlashCommands(query);
  if (commands.length === 0) {
    return null;
  }
  const index = ((selected % commands.length) + commands.length) % commands.length;
  return {
    from: selection.$from.start(),
    to: selection.$from.end(),
    text: parent.textContent,
    query,
    commands,
    selected: index,
  };
}

function storedSlash(state: EditorState): SlashPluginState {
  return slashKey.getState(state) ?? { selected: 0, dismissed: null };
}

export function visibleSlashSession(state: EditorState): SlashSession | null {
  const stored = storedSlash(state);
  if (stored.dismissed !== null) {
    return null;
  }
  return slashSession(state, stored.selected);
}

function slashMenu(session: SlashSession, view: EditorView): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'wysiwyg-slash';
  menu.setAttribute('role', 'listbox');
  for (const [index, command] of session.commands.entries()) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'wysiwyg-slash-item';
    option.setAttribute('role', 'option');
    option.textContent = `${command.label} — ${command.description}`;
    if (index === session.selected) {
      option.dataset.selected = 'true';
    }
    option.addEventListener('mousedown', (event) => {
      event.preventDefault();
      applySlashCommand(view, command);
    });
    menu.appendChild(option);
  }
  return menu;
}

function slashDecorations(state: EditorState): DecorationSet | null {
  const session = visibleSlashSession(state);
  if (!session) {
    return null;
  }
  const widget = Decoration.widget(session.to, (view) => slashMenu(session, view), {
    side: 1,
    ignoreSelection: true,
  });
  return DecorationSet.create(state.doc, [widget]);
}

function replaceBlock(state: EditorState, from: number, parsed: ProseMirrorNode): Transaction | null {
  const $pos = state.doc.resolve(from);
  if ($pos.depth < 1) {
    return null;
  }
  const start = $pos.before($pos.depth);
  const end = start + $pos.parent.nodeSize;
  const tr = state.tr.replaceWith(start, end, parsed.content);
  const position = Math.min(start + 1, tr.doc.content.size);
  return tr.setSelection(TextSelection.near(tr.doc.resolve(position))).scrollIntoView();
}

/** Replace the `/query` block with the command's markdown. */
export function applySlashCommand(view: EditorView, command: SlashCommand): boolean {
  const session = slashSession(view.state);
  const markdown = command.template.endsWith('\n') ? command.template : `${command.template}\n`;
  const parsed = session ? parseMdxContent(markdown) : null;
  const tr = session && parsed && parsed.childCount > 0 ? replaceBlock(view.state, session.from, parsed) : null;
  if (!tr) {
    return false;
  }
  view.dispatch(tr);
  view.focus();
  return true;
}

function moveSlashSelection(view: EditorView, selected: number): boolean {
  view.dispatch(view.state.tr.setMeta(slashKey, { selected }));
  return true;
}

/** Keyboard controls for the open slash menu. */
export function handleSlashKey(view: EditorView, key: string): boolean {
  const session = visibleSlashSession(view.state);
  if (!session) {
    return false;
  }
  if (key === 'ArrowDown') {
    return moveSlashSelection(view, session.selected + 1);
  }
  if (key === 'ArrowUp') {
    return moveSlashSelection(view, session.selected - 1);
  }
  if (key === 'Enter') {
    const command = session.commands[session.selected];
    return command ? applySlashCommand(view, command) : false;
  }
  if (key === 'Escape') {
    view.dispatch(view.state.tr.setMeta(slashKey, { dismissed: session.text }));
    return true;
  }
  return false;
}

function nextSlashState(tr: EditorState['tr'], value: SlashPluginState, state: EditorState): SlashPluginState {
  const meta = tr.getMeta(slashKey) as { selected?: number; dismissed?: string } | undefined;
  if (meta?.dismissed !== undefined) {
    return { selected: 0, dismissed: meta.dismissed };
  }
  if (paragraphText(state) === value.dismissed) {
    return value;
  }
  return {
    selected: meta?.selected ?? (tr.docChanged ? 0 : value.selected),
    dismissed: null,
  };
}

/** Slash command menu for the visual editor. */
export function wysiwygSlashPlugin(): Plugin<SlashPluginState> {
  return new Plugin<SlashPluginState>({
    key: slashKey,
    state: {
      init: (): SlashPluginState => ({ selected: 0, dismissed: null }),
      apply: (tr, value, _old, state) => nextSlashState(tr, value, state),
    },
    props: {
      decorations: slashDecorations,
      handleKeyDown: (view, event) => handleSlashKey(view, event.key),
    },
  });
}
