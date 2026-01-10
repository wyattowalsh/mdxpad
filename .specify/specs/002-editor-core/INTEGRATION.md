# Integration Guide: Editor Core (002)

**Date**: 2026-01-09
**Feature**: CodeMirror 6 integration for MDX editing
**Related**: [spec.md](./spec.md) | [data-model.md](./data-model.md) | [quickstart.md](./quickstart.md)

---

## Table of Contents

1. [Wiring Toolbar Buttons](#1-wiring-toolbar-buttons)
2. [File System Integration](#2-file-system-integration)
3. [Performance Optimization](#3-performance-optimization)
4. [Error Handling Patterns](#4-error-handling-patterns)
5. [Custom Extensions](#5-custom-extensions)

---

## 1. Wiring Toolbar Buttons

The editor exposes an `executeCommand()` function through the `useCodeMirror` hook that allows external UI elements (like toolbar buttons) to trigger editor commands programmatically.

### Available Commands

```typescript
type EditorCommandName =
  | 'bold'        // Wrap selection in **
  | 'italic'      // Wrap selection in *
  | 'code'        // Wrap selection in `
  | 'link'        // Insert [text](url)
  | 'heading1'    // Prefix line with #
  | 'heading2'    // Prefix line with ##
  | 'heading3'    // Prefix line with ###
  | 'undo'        // Undo last change
  | 'redo'        // Redo last undo
  | 'find'        // Open find panel
  | 'findReplace' // Open find/replace panel
  | 'goToLine';   // Open go-to-line dialog
```

### Basic Toolbar Integration

```tsx
import { useCodeMirror } from '@/renderer/hooks/useCodeMirror';
import type { EditorCommandName } from '@/renderer/hooks/useCodeMirror';

function EditorWithToolbar() {
  const {
    containerRef,
    executeCommand,
    focus,
    state,
  } = useCodeMirror({
    initialDoc: '# My Document',
    onChange: (s) => console.log('Content:', s.doc),
  });

  // Handler that executes command and refocuses editor
  const handleCommand = (command: EditorCommandName) => {
    const success = executeCommand(command);
    if (success) {
      focus(); // Return focus to editor after toolbar click
    }
  };

  return (
    <div className="editor-container">
      <Toolbar onCommand={handleCommand} />
      <div ref={containerRef} className="editor" />
    </div>
  );
}

// Toolbar component
function Toolbar({ onCommand }: { onCommand: (cmd: EditorCommandName) => void }) {
  return (
    <div className="toolbar">
      <button onClick={() => onCommand('bold')} title="Bold (Cmd+B)">
        <BoldIcon />
      </button>
      <button onClick={() => onCommand('italic')} title="Italic (Cmd+I)">
        <ItalicIcon />
      </button>
      <button onClick={() => onCommand('code')} title="Code (Cmd+E)">
        <CodeIcon />
      </button>
      <div className="separator" />
      <button onClick={() => onCommand('heading1')} title="Heading 1 (Cmd+1)">
        H1
      </button>
      <button onClick={() => onCommand('heading2')} title="Heading 2 (Cmd+2)">
        H2
      </button>
      <button onClick={() => onCommand('heading3')} title="Heading 3 (Cmd+3)">
        H3
      </button>
      <div className="separator" />
      <button onClick={() => onCommand('link')} title="Link (Cmd+K)">
        <LinkIcon />
      </button>
      <div className="separator" />
      <button onClick={() => onCommand('undo')} title="Undo (Cmd+Z)">
        <UndoIcon />
      </button>
      <button onClick={() => onCommand('redo')} title="Redo (Cmd+Shift+Z)">
        <RedoIcon />
      </button>
    </div>
  );
}
```

### Formatting Command Selection Behavior

Formatting commands (`bold`, `italic`, `code`, `link`) adapt to the current selection state:

- **With selection**: Wraps the selected text with formatting markers
  - Example: Select "hello" then `Cmd+B` results in `**hello**`
- **Without selection**: Inserts formatting markers at cursor position
  - Example: Cursor at position then `Cmd+B` results in `****` with cursor between markers
  - User can immediately type text that will appear formatted

| Command | With Selection | Without Selection |
|---------|---------------|-------------------|
| `bold` | `**selection**` | `****` (cursor between) |
| `italic` | `*selection*` | `**` (cursor between) |
| `code` | `` `selection` `` | ``` `` ``` (cursor between) |
| `link` | `[selection](url)` | `[link text](url)` (selects "link text") |

The `link` command has special behavior: without a selection, it inserts a full placeholder `[link text](url)` and automatically selects "link text" for immediate replacement.

```tsx
// Toolbar buttons work regardless of selection state
const handleBoldClick = () => {
  executeCommand('bold'); // Works with or without selection
  focus();
};
```

### Command Return Values

`executeCommand()` returns a boolean indicating success:

```tsx
const success = executeCommand('bold');

if (!success) {
  // Command threw an exception during execution
  console.warn('Command could not be executed');
}
```

### Disabling Buttons Based on State

Use the editor state to conditionally enable/disable toolbar buttons.

> **Note**: Formatting commands (`bold`, `italic`, `code`, `link`) work both with and without a selection (see [Formatting Command Selection Behavior](#formatting-command-selection-behavior)), so they generally do not need to be disabled.

```tsx
function SmartToolbar({ state, selection, onCommand }) {
  // Formatting buttons work with or without selection - no need to disable
  // They insert markers at cursor position when nothing is selected

  // Example: disable a hypothetical "delete selection" button when nothing is selected
  const hasSelection = selection && !selection.empty;

  return (
    <div className="toolbar">
      <button onClick={() => onCommand('bold')}>
        Bold
      </button>
      <button onClick={() => onCommand('italic')}>
        Italic
      </button>
      {/* Hypothetical command that requires selection */}
      <button
        onClick={() => onCommand('deleteSelection')}
        disabled={!hasSelection}
        aria-disabled={!hasSelection}
      >
        Delete Selection
      </button>
    </div>
  );
}
```

### Using with the MDXEditor Component

When using the high-level `MDXEditor` component, use a ref to access commands:

```tsx
import { useRef } from 'react';
import { MDXEditor } from '@/renderer/components/editor';
import type { UseCodeMirrorReturn } from '@/renderer/hooks/useCodeMirror';

function App() {
  const editorRef = useRef<UseCodeMirrorReturn>(null);
  const [content, setContent] = useState('');

  const handleToolbarCommand = (command: EditorCommandName) => {
    editorRef.current?.executeCommand(command);
    editorRef.current?.focus();
  };

  return (
    <div>
      <Toolbar onCommand={handleToolbarCommand} />
      <MDXEditor
        ref={editorRef}
        value={content}
        onChange={(s) => setContent(s.doc)}
      />
    </div>
  );
}
```

---

## 2. File System Integration

> **Note**: Full file system integration is deferred to **Spec 003**. This section describes the pattern for loading and saving documents using the current controlled component API.

### Current Pattern: Controlled Component

The `MDXEditor` is a **controlled component** that receives content via `value` prop and reports changes via `onChange`. File operations happen outside the editor:

```tsx
import { MDXEditor } from '@/renderer/components/editor';
import type { EditorState } from '@shared/types/editor';

function DocumentEditor() {
  const [content, setContent] = useState<string>('');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Load document content (file loading handled externally)
  const loadDocument = async (path: string) => {
    // Future: This will use Spec 003 file system APIs
    // For now, assume content comes from props or IPC
    const fileContent = await window.electronAPI.readFile(path);
    setContent(fileContent);
    setFilePath(path);
    setIsDirty(false);
  };

  // Handle editor changes
  const handleChange = (state: EditorState) => {
    setContent(state.doc);
    setIsDirty(true);
  };

  // Save document content
  const saveDocument = async () => {
    if (!filePath) return;
    // Future: This will use Spec 003 file system APIs
    await window.electronAPI.writeFile(filePath, content);
    setIsDirty(false);
  };

  return (
    <div>
      <header>
        {filePath && <span>{filePath}</span>}
        {isDirty && <span>(unsaved)</span>}
        <button onClick={saveDocument} disabled={!isDirty}>
          Save
        </button>
      </header>
      <MDXEditor
        value={content}
        onChange={handleChange}
      />
    </div>
  );
}
```

### Preparing for Spec 003

When Spec 003 (File System) is implemented, the pattern will evolve to:

```tsx
// Future pattern with Spec 003
import { useDocument } from '@/renderer/hooks/useDocument'; // Spec 003

function DocumentEditor({ documentId }: { documentId: string }) {
  const {
    content,
    setContent,
    save,
    isDirty,
    error
  } = useDocument(documentId);

  return (
    <MDXEditor
      value={content}
      onChange={(state) => setContent(state.doc)}
      onError={(err) => console.error(err)}
    />
  );
}
```

### Initial Content Loading

For now, pass initial content as the `value` prop:

```tsx
// From parent component or route
function App() {
  const initialContent = useMemo(() => {
    // Could come from:
    // - Route params
    // - IPC from main process
    // - URL query string
    // - localStorage (for drafts)
    return localStorage.getItem('draft') || '# New Document\n';
  }, []);

  const [content, setContent] = useState(initialContent);

  return (
    <MDXEditor
      value={content}
      onChange={(s) => setContent(s.doc)}
    />
  );
}
```

### Auto-Save Pattern

Implement auto-save using the debounced `onChange`:

```tsx
function AutoSaveEditor({ documentId }) {
  const [content, setContent] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Auto-save handler (already debounced by editor)
  const handleChange = useCallback(async (state: EditorState) => {
    setContent(state.doc);

    // Additional debounce for save (optional, since onChange is already debounced)
    await saveDraft(documentId, state.doc);
    setLastSaved(new Date());
  }, [documentId]);

  return (
    <div>
      <MDXEditor
        value={content}
        onChange={handleChange}
        debounceMs={300} // Increase debounce for auto-save
      />
      {lastSaved && (
        <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
      )}
    </div>
  );
}
```

---

## 3. Performance Optimization

The editor is designed to handle documents up to 10MB while maintaining keystroke latency under 16ms. Here are strategies for optimal performance.

### Debounce Settings

The `debounceMs` prop controls how often `onChange` fires:

```tsx
// Default: 150ms - good for most use cases
<MDXEditor debounceMs={150} onChange={handleChange} />

// Higher debounce for expensive operations (auto-save, preview)
<MDXEditor debounceMs={300} onChange={handleExpensiveChange} />

// Lower debounce for real-time collaboration (more network traffic)
<MDXEditor debounceMs={50} onChange={handleRealtimeSync} />

// No debounce (not recommended - can cause performance issues)
<MDXEditor debounceMs={0} onChange={handleEveryKeystroke} />
```

### Large Document Strategies

For documents over 10,000 characters:

```tsx
function LargeDocumentEditor({ content }) {
  // 1. Increase debounce to reduce callback frequency
  const debounceMs = content.length > 50000 ? 500 : 150;

  // 2. Memoize expensive callbacks
  const handleChange = useCallback((state: EditorState) => {
    // Only update if content actually changed
    setContent((prev) => {
      if (prev === state.doc) return prev;
      return state.doc;
    });
  }, []);

  // 3. Disable features that impact performance on large docs
  const showLineNumbers = content.length < 100000;

  return (
    <MDXEditor
      value={content}
      onChange={handleChange}
      debounceMs={debounceMs}
      lineNumbers={showLineNumbers}
      highlightActiveLine={content.length < 50000}
    />
  );
}
```

### Virtual Scrolling Considerations

CodeMirror 6 handles virtual scrolling internally. The editor only renders visible lines, making it efficient for large documents. However:

```tsx
// DO: Let CodeMirror handle scrolling
<div style={{ height: '100vh' }}>
  <MDXEditor value={largeContent} height="100%" />
</div>

// DON'T: Wrap in external virtual scroll container
// This conflicts with CodeMirror's internal virtualization
<VirtualList>
  <MDXEditor value={largeContent} /> {/* Bad - double virtualization */}
</VirtualList>
```

### Syntax Highlighting Performance

For extremely large files, syntax highlighting can be disabled:

```tsx
// Custom extension to disable syntax highlighting for performance
import { syntaxHighlighting } from '@codemirror/language';

// In large document mode, use minimal highlighting
const minimalExtensions = [
  // Basic text editing only
  EditorView.lineWrapping,
  lineNumbers(),
  // No syntax highlighting
];
```

### Memory Management

Avoid memory leaks with proper cleanup:

```tsx
function Editor() {
  const [content, setContent] = useState('');

  // Use useCallback to prevent new function references
  const handleChange = useCallback((state: EditorState) => {
    setContent(state.doc);
  }, []);

  // Clean up on unmount is handled automatically by the hook
  // The EditorView is destroyed when the component unmounts

  return <MDXEditor value={content} onChange={handleChange} />;
}
```

### Profiling Performance

Use React DevTools and browser performance tools:

```tsx
// Wrap in Profiler for performance monitoring
import { Profiler } from 'react';

function ProfiledEditor({ content }) {
  const onRenderCallback = (
    id: string,
    phase: string,
    actualDuration: number
  ) => {
    if (actualDuration > 16) {
      console.warn(`Editor render took ${actualDuration}ms (target: <16ms)`);
    }
  };

  return (
    <Profiler id="MDXEditor" onRender={onRenderCallback}>
      <MDXEditor value={content} onChange={setContent} />
    </Profiler>
  );
}
```

---

## 4. Error Handling Patterns

The editor emits structured errors via the `onError` callback. All errors are also logged to the console for debugging.

### EditorError Structure

```typescript
interface EditorError {
  /** Category of error */
  readonly type: 'syntax' | 'command' | 'extension';
  /** Human-readable error description */
  readonly message: string;
  /** Unix timestamp (ms) when error occurred */
  readonly timestamp: number;
  /** Optional additional data for debugging */
  readonly context?: Record<string, unknown>;
}
```

### Error Types

| Type | Description | Example |
|------|-------------|---------|
| `syntax` | Syntax highlighting or parsing failure | Invalid MDX that breaks parser |
| `command` | Keyboard command execution failure | Command failed on empty selection |
| `extension` | Extension initialization or runtime error | Theme loading failed |

### Basic Error Handling

```tsx
import { MDXEditor } from '@/renderer/components/editor';
import type { EditorError } from '@/renderer/hooks/useCodeMirror';

function Editor() {
  const handleError = (error: EditorError) => {
    // Errors are automatically logged to console
    // Handle in UI as needed

    switch (error.type) {
      case 'syntax':
        // Usually safe to ignore - editor continues working
        console.debug('Syntax issue:', error.message);
        break;

      case 'command':
        // Command didn't execute - might show user feedback
        showToast(`Action failed: ${error.message}`);
        break;

      case 'extension':
        // More serious - might affect editor functionality
        showErrorBanner(`Editor error: ${error.message}`);
        break;
    }
  };

  return (
    <MDXEditor
      value={content}
      onChange={handleChange}
      onError={handleError}
    />
  );
}
```

### Error Recovery Strategies

```tsx
function ResilientEditor() {
  const [error, setError] = useState<EditorError | null>(null);
  const [content, setContent] = useState('');
  const [fallbackMode, setFallbackMode] = useState(false);

  const handleError = (err: EditorError) => {
    setError(err);

    // Recovery strategy based on error type
    if (err.type === 'extension') {
      // Disable problematic features
      setFallbackMode(true);

      // Clear error after showing message
      setTimeout(() => setError(null), 5000);
    }
  };

  // Fallback to minimal editor on extension errors
  if (fallbackMode) {
    return (
      <div>
        <div className="warning-banner">
          Running in fallback mode. Some features disabled.
          <button onClick={() => setFallbackMode(false)}>
            Retry Full Mode
          </button>
        </div>
        <MDXEditor
          value={content}
          onChange={(s) => setContent(s.doc)}
          onError={handleError}
          // Disable features that might cause issues
          highlightActiveLine={false}
          bracketMatching={false}
          closeBrackets={false}
        />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="error-banner">
          {error.message}
        </div>
      )}
      <MDXEditor
        value={content}
        onChange={(s) => setContent(s.doc)}
        onError={handleError}
      />
    </div>
  );
}
```

### Error Logging and Telemetry

```tsx
function InstrumentedEditor() {
  const handleError = (error: EditorError) => {
    // Send to error tracking service
    errorTracker.captureException(new Error(error.message), {
      tags: {
        component: 'MDXEditor',
        errorType: error.type,
      },
      extra: {
        timestamp: error.timestamp,
        context: error.context,
      },
    });

    // Also log locally
    console.error(`[Editor ${error.type}]`, error.message, error.context);
  };

  return <MDXEditor onError={handleError} /* ... */ />;
}
```

### Testing Error Handlers

```tsx
// In tests
import { render, screen } from '@testing-library/react';
import { MDXEditor } from '@/renderer/components/editor';

test('calls onError when command fails', async () => {
  const onError = vi.fn();

  const { executeCommand } = render(
    <MDXEditor
      value=""
      onChange={() => {}}
      onError={onError}
    />
  );

  // Try to execute bold on empty document with no selection
  // This should fail gracefully and call onError
  executeCommand('bold');

  expect(onError).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'command',
      message: expect.any(String),
    })
  );
});
```

---

## 5. Custom Extensions

CodeMirror 6's extension system allows deep customization. The editor supports adding custom extensions beyond the built-in features.

### Extension Architecture

CodeMirror 6 uses a composable extension system:

```typescript
import { Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
```

### Adding Custom Extensions via Hook

Use the `useCodeMirror` hook with custom extensions:

```tsx
import { useCodeMirror } from '@/renderer/hooks/useCodeMirror';
import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

// Custom extension: character count in gutter
const characterCountExtension: Extension = EditorView.updateListener.of(
  (update) => {
    if (update.docChanged) {
      const count = update.state.doc.length;
      // Update external state or DOM
      document.getElementById('char-count')!.textContent = String(count);
    }
  }
);

function EditorWithCharCount() {
  const { containerRef } = useCodeMirror({
    initialDoc: 'Hello',
    extensions: [characterCountExtension],
  });

  return (
    <div>
      <div ref={containerRef} />
      <div id="char-count" />
    </div>
  );
}
```

### Custom Keybindings

Add custom keyboard shortcuts:

```tsx
import { keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';

const customKeymap = keymap.of([
  {
    key: 'Mod-Shift-c',
    run: (view) => {
      // Custom command: copy as markdown
      const content = view.state.doc.toString();
      navigator.clipboard.writeText(content);
      return true; // Command handled
    },
  },
  {
    key: 'Mod-Shift-p',
    run: (view) => {
      // Custom command: open command palette
      openCommandPalette(view);
      return true;
    },
  },
]);

function EditorWithCustomKeys() {
  const { containerRef } = useCodeMirror({
    extensions: [customKeymap],
  });

  return <div ref={containerRef} />;
}
```

### Custom Decorations

Add visual decorations to the editor:

```tsx
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Highlight TODO comments
const todoHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const todoRegex = /TODO:/g;

      for (const { from, to } of view.visibleRanges) {
        const text = view.state.sliceDoc(from, to);
        let match;
        while ((match = todoRegex.exec(text)) !== null) {
          const start = from + match.index;
          const end = start + match[0].length;
          builder.add(
            start,
            end,
            Decoration.mark({ class: 'cm-todo-highlight' })
          );
        }
      }

      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// Use in editor
const { containerRef } = useCodeMirror({
  extensions: [todoHighlighter],
});
```

### Custom State Fields

Store custom state within the editor:

```tsx
import { StateField, StateEffect } from '@codemirror/state';

// Define a state effect for updates
const setWordCountEffect = StateEffect.define<number>();

// Define the state field
const wordCountField = StateField.define<number>({
  create: () => 0,
  update: (value, tr) => {
    // Recalculate on document changes
    if (tr.docChanged) {
      const text = tr.newDoc.toString();
      return text.split(/\s+/).filter(Boolean).length;
    }
    return value;
  },
});

// Access the state field
function getWordCount(state: EditorState): number {
  return state.field(wordCountField);
}

// Use in component
function EditorWithWordCount() {
  const { containerRef, state } = useCodeMirror({
    extensions: [wordCountField],
  });

  const wordCount = state ? getWordCount(state) : 0;

  return (
    <div>
      <div ref={containerRef} />
      <div>Words: {wordCount}</div>
    </div>
  );
}
```

### Custom Language Support

Extend the MDX language with custom syntax:

```tsx
import { LanguageSupport, LRLanguage } from '@codemirror/language';
import { styleTags, tags as t } from '@lezer/highlight';

// Custom tags for your syntax
const customHighlighting = styleTags({
  'CustomTag': t.special(t.name),
  'CustomAttribute': t.attributeName,
});

// Combine with existing MDX support
function EditorWithCustomSyntax() {
  const { containerRef } = useCodeMirror({
    // Custom language support would be added here
    // See research.md for MDX language implementation details
  });

  return <div ref={containerRef} />;
}
```

### Extension Composition Pattern

Organize extensions in a maintainable way:

```tsx
// extensions/index.ts
import { Extension } from '@codemirror/state';

export function createEditorExtensions(config: ExtensionConfig): Extension[] {
  const extensions: Extension[] = [];

  // Core extensions (always included)
  extensions.push(coreExtensions());

  // Optional extensions based on config
  if (config.wordCount) {
    extensions.push(wordCountExtension());
  }

  if (config.todoHighlight) {
    extensions.push(todoHighlighter);
  }

  if (config.customKeymap) {
    extensions.push(keymap.of(config.customKeymap));
  }

  return extensions;
}

// Usage
function CustomEditor() {
  const extensions = useMemo(
    () =>
      createEditorExtensions({
        wordCount: true,
        todoHighlight: true,
        customKeymap: [
          { key: 'Mod-Shift-c', run: copyAsMarkdown },
        ],
      }),
    []
  );

  const { containerRef } = useCodeMirror({
    extensions,
  });

  return <div ref={containerRef} />;
}
```

### Testing Custom Extensions

```tsx
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

describe('wordCountField', () => {
  test('counts words correctly', () => {
    const state = EditorState.create({
      doc: 'Hello world foo bar',
      extensions: [wordCountField],
    });

    expect(getWordCount(state)).toBe(4);
  });

  test('updates on document change', () => {
    const view = new EditorView({
      state: EditorState.create({
        doc: 'Hello',
        extensions: [wordCountField],
      }),
    });

    expect(getWordCount(view.state)).toBe(1);

    view.dispatch({
      changes: { from: 5, insert: ' world' },
    });

    expect(getWordCount(view.state)).toBe(2);

    view.destroy();
  });
});
```

---

## Summary

This integration guide covers the key patterns for working with the MDXEditor:

1. **Toolbar Integration**: Use `executeCommand()` to wire buttons to editor commands
2. **File System**: Use controlled component pattern with `value`/`onChange` (full file system in Spec 003)
3. **Performance**: Adjust `debounceMs`, disable features for large docs, let CodeMirror handle virtualization
4. **Error Handling**: Use `onError` callback with `EditorError` structure for graceful degradation
5. **Extensions**: Leverage CodeMirror 6's composable extension system for custom functionality

For implementation details, see [quickstart.md](./quickstart.md) and [contracts/editor-api.ts](./contracts/editor-api.ts).
