# Editor Extensions

MDXPad's editor is built on CodeMirror 6 with a rich set of custom extensions located in `src/renderer/lib/editor/extensions/`.

## Extension Overview

| Extension | File | Description |
|-----------|------|-------------|
| Multi-Cursor | `multi-cursor.ts` | Select next/all occurrences |
| Code Folding | `code-folding.ts` | Fold frontmatter, code fences, JSX blocks |
| Regex Find/Replace | `find-replace-regex.ts` | Regex search with capture groups |
| Word Wrap | `word-wrap.ts` | Configurable word wrapping |
| Snippets | `snippets-engine.ts` | Expandable MDX snippets |
| Minimap | `minimap.ts` | Document overview sidebar |
| Focus Mode | `focus-mode.ts` | Highlight current paragraph |
| Distraction-Free | `distraction-free.ts` | Hide UI for writing focus |
| Spellcheck | `spellcheck.ts` | Real-time spell checking |
| Font Settings | `font-settings.ts` | Configurable font family, size, line height |
| Code Execution | `code-execution.ts` | Run code blocks inline |
| Go-to-Definition | `go-to-definition.ts` | Navigate to component definitions |
| Slash Commands | `slash-commands.ts` | `/command` autocomplete |
| Next-Edit Prediction | `next-edit-prediction.ts` | AI ghost text completions |

All extensions are exported from `src/renderer/lib/editor/extensions/index.ts`.

## Multi-Cursor

Adds VS Code-style multi-cursor selection.

```typescript
import { multiCursorExtension, selectNextOccurrence, selectAllOccurrences } from './multi-cursor';
```

- `selectNextOccurrence` -- Add cursor at next match of current selection
- `selectAllOccurrences` -- Select all matches at once

## Code Folding

Custom fold strategies for MDX-specific constructs.

```typescript
import { codeFoldingExtension, foldFrontmatter, foldCodeFence, foldJsxBlock } from './code-folding';
```

Supports folding:
- YAML frontmatter blocks (`---`)
- Fenced code blocks (``` ```)
- JSX/MDX component blocks

## Regex Find/Replace

Enhanced search with regex support and capture group expansion.

```typescript
import { regexSearchExtension, toggleRegex, toggleCaseSensitive, expandCaptureGroups } from './find-replace-regex';
```

State is managed via `regexSearchField` with toggle effects for regex mode and case sensitivity.

## Snippets Engine

Predefined MDX snippets with tab-stop expansion.

```typescript
import { createSnippetCompletionSource, MDX_SNIPPETS } from './snippets-engine';

interface Snippet {
  label: string;      // Trigger text
  template: string;   // Expansion template with $1, $2 placeholders
  description: string;
}
```

Built-in snippets include common MDX patterns. Custom snippets can be provided via `createSnippetSource()`.

## Minimap

Document overview rendered as a scaled-down sidebar.

```typescript
import { minimapExtension } from './minimap';
```

## Focus Mode

Dims non-focused paragraphs to reduce visual noise.

```typescript
import { focusModeExtension } from './focus-mode';
```

## Distraction-Free Mode

Hides all UI chrome (sidebar, status bar, tabs) for immersive writing.

```typescript
import { distractionFreeExtension, createDistractionFreeState } from './distraction-free';
```

Managed via `DistractionFreeState` interface with toggle support.

## Spellcheck

Real-time spell checking with custom dictionary support.

```typescript
import { spellcheckExtension } from './spellcheck';

interface SpellcheckOptions {
  language?: string;
  customDictionary?: string[];
}
```

Custom dictionary words are defined in `spellcheck-dictionary.ts`.

## Font Settings

Runtime-configurable editor font properties.

```typescript
import { createFontSettingsExtension } from './font-settings';

interface FontSettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}
```

## Keymaps

Alternative keymap modes in `src/renderer/lib/editor/keymaps/`:

| Keymap | File | Description |
|--------|------|-------------|
| Vim | `vim-keymap.ts` | Vim modal editing emulation |
| Emacs | `emacs-keymap.ts` | Emacs key bindings |

Keymaps are exported from `src/renderer/lib/editor/keymaps/index.ts`.

## Slash Commands

Type `/` to trigger an autocomplete menu with available commands.

```typescript
import { slashCommandExtension } from './slash-commands';
```

Command definitions are in `slash-command-definitions.ts`.

## Code Execution

Execute JavaScript/TypeScript code blocks directly in the editor.

### Components

- Extension: `src/renderer/lib/editor/extensions/code-execution.ts`
- Sandbox: `src/renderer/features/code-execution/sandbox-runner.ts`
- Output Widget: `src/renderer/features/code-execution/CodeOutputWidget.tsx`

Code runs in a sandboxed environment with output displayed inline below the code block.

## WYSIWYG Editor

ProseMirror-based WYSIWYG editing mode as an alternative to the CodeMirror source view.

### Components

- `WysiwygEditor` (`src/renderer/components/editor/WysiwygEditor.tsx`) -- ProseMirror editor component
- `WysiwygToolbar` (`src/renderer/components/editor/WysiwygToolbar.tsx`) -- Formatting toolbar
- `EditorModeToggle` (`src/renderer/components/editor/EditorModeToggle.tsx`) -- Source/WYSIWYG switch
- `prosemirror-mdx-schema.ts` (`src/renderer/lib/editor/`) -- MDX document schema
- `prosemirror-mdx-parser.ts` -- Markdown to ProseMirror parser
- `prosemirror-mdx-serializer.ts` -- ProseMirror to Markdown serializer

### Dependencies

- `prosemirror-state`, `prosemirror-view`, `prosemirror-model`
- `prosemirror-commands`, `prosemirror-keymap`
- `prosemirror-markdown`, `prosemirror-schema-basic`

### Editor Mode Store

The `useEditorModeStore` (`src/renderer/stores/editor-mode-store.ts`) tracks the current mode (`source` or `wysiwyg`).

## Configuration

Editor extensions are composed in `src/renderer/hooks/useCodeMirror/extensions.ts`. The extension list is assembled based on user preferences stored in `useEditorPreferencesStore` (`src/renderer/stores/editor-preferences-store.ts`).

High contrast theme support is provided in `src/renderer/hooks/useCodeMirror/high-contrast-theme.ts`.
