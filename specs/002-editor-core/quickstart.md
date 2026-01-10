# Quickstart: Editor Core (002)

**Date**: 2026-01-09
**Feature**: CodeMirror 6 integration for MDX editing

## Overview

This feature adds a fully-functional MDX editor built on CodeMirror 6. The editor supports:
- MDX syntax highlighting (Markdown + JSX + frontmatter)
- Keyboard commands for formatting
- Find/replace and navigation
- Light/dark theme with system preference support
- Configurable settings (line numbers, word wrap, tab size)

---

## Quick Usage

### Basic Editor Component

```tsx
import { MDXEditor } from '@/renderer/components/editor';

function App() {
  const [content, setContent] = useState('# Hello MDX\n\n<Button>Click me</Button>');

  return (
    <MDXEditor
      value={content}
      onChange={(state) => setContent(state.doc)}
      theme="system"
    />
  );
}
```

### With All Options

```tsx
import { MDXEditor } from '@/renderer/components/editor';

function App() {
  const [content, setContent] = useState('');

  const handleChange = (state: EditorState) => {
    setContent(state.doc);
    console.log('Selection:', state.selection);
  };

  const handleError = (error: EditorError) => {
    console.error(`[${error.type}] ${error.message}`, error.context);
  };

  return (
    <MDXEditor
      value={content}
      onChange={handleChange}
      onError={handleError}
      onSelectionChange={(sel) => console.log('Selection:', sel)}
      theme="system"
      lineNumbers={true}
      lineWrapping={false}
      tabSize={2}
      debounceMs={150}
      highlightActiveLine={true}
      bracketMatching={true}
      closeBrackets={true}
      indentationGuides={true}
      className="my-editor"
      height="500px"
    />
  );
}
```

### Using the Hook Directly

```tsx
import { useCodeMirror } from '@/renderer/hooks/useCodeMirror';

function CustomEditor() {
  const {
    containerRef,
    state,
    selection,
    setValue,
    setSelection,
    executeCommand,
    focus,
    isFocused,
  } = useCodeMirror({
    initialDoc: '# Hello',
    theme: 'dark',
    lineNumbers: true,
    onChange: (state) => console.log('Changed:', state.doc),
  });

  return (
    <div>
      <div ref={containerRef} style={{ height: '400px' }} />
      <button onClick={() => executeCommand('bold')}>Bold</button>
      <button onClick={() => focus()}>Focus</button>
      <span>Focused: {isFocused ? 'Yes' : 'No'}</span>
    </div>
  );
}
```

---

## Keyboard Shortcuts

| Command | Shortcut | Description |
|---------|----------|-------------|
| Bold | `Cmd+B` | Wrap selection in `**` |
| Italic | `Cmd+I` | Wrap selection in `*` |
| Code | `Cmd+E` | Wrap selection in `` ` `` |
| Link | `Cmd+K` | Insert `[text](url)` |
| Heading 1 | `Cmd+1` | Add `# ` prefix |
| Heading 2 | `Cmd+2` | Add `## ` prefix |
| Heading 3 | `Cmd+3` | Add `### ` prefix |
| Undo | `Cmd+Z` | Undo last change |
| Redo | `Cmd+Shift+Z` | Redo last undo |
| Find | `Cmd+F` | Open find panel |
| Replace | `Cmd+Shift+F` | Open find/replace panel |
| Go to Line | `Cmd+G` | Jump to line number |

---

## File Structure

```
src/renderer/
├── components/
│   └── editor/
│       ├── MDXEditor.tsx           # Main component
│       ├── MDXEditor.test.tsx      # Tests
│       └── index.ts                # Exports
├── hooks/
│   └── useCodeMirror/
│       ├── useCodeMirror.ts        # Core hook
│       ├── useCodeMirror.test.ts   # Tests
│       ├── extensions.ts           # CM extensions
│       ├── commands.ts             # Keyboard commands
│       ├── themes.ts               # Theme config
│       └── index.ts                # Exports
└── lib/
    └── editor/
        ├── mdx-language.ts         # MDX syntax
        ├── state-bridge.ts         # Type conversion
        ├── errors.ts               # Error handling
        └── index.ts                # Exports
```

---

## Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "@codemirror/state": "^6.5.3",
    "@codemirror/view": "^6.39.9",
    "@codemirror/commands": "^6.10.1",
    "@codemirror/language": "^6.12.1",
    "@codemirror/language-data": "^6.5.2",
    "@codemirror/lang-markdown": "^6.5.0",
    "@codemirror/lang-javascript": "^6.2.4",
    "@codemirror/lang-yaml": "^6.1.2",
    "@codemirror/search": "^6.5.11",
    "@codemirror/autocomplete": "^6.20.0",
    "@codemirror/theme-one-dark": "^6.1.3",
    "@lezer/highlight": "^1.2.3"
  }
}
```

---

## Testing

Run editor tests:

```bash
# Unit tests
pnpm test src/renderer/components/editor
pnpm test src/renderer/hooks/useCodeMirror
pnpm test src/renderer/lib/editor

# All tests
pnpm test
```

### Test Coverage Requirements

Per Constitution Article VI Section 6.4:
- Unit coverage > 80% for `src/renderer/lib/editor/`
- Component tests for MDXEditor
- Hook tests for useCodeMirror

---

## Performance

Per Constitution Article V:
- Editor renders and accepts input within 100ms
- Keystroke latency < 16ms (p99) for documents up to 10,000 characters

Run benchmarks:

```bash
pnpm bench
```

---

## Common Patterns

### Controlled vs Uncontrolled

The MDXEditor is a **controlled component**. You must provide `value` and `onChange`:

```tsx
// Correct - controlled
<MDXEditor value={content} onChange={(s) => setContent(s.doc)} />

// Wrong - uncontrolled is not supported
<MDXEditor defaultValue={content} />
```

### Programmatic Updates

Use the hook to update content programmatically:

```tsx
const { setValue, setSelection } = useCodeMirror({ ... });

// Update content
setValue('# New content');

// Set cursor position
setSelection(0); // Cursor at start

// Set selection range
setSelection(0, 10); // Select first 10 chars
```

### Executing Commands

```tsx
const { executeCommand } = useCodeMirror({ ... });

// Execute formatting command
executeCommand('bold');
executeCommand('italic');

// Open panels
executeCommand('find');
executeCommand('goToLine');
```

### Error Handling

```tsx
<MDXEditor
  onError={(error) => {
    // Log to console (automatic)
    // Handle in UI if needed
    if (error.type === 'command') {
      showToast(`Command failed: ${error.message}`);
    }
  }}
/>
```
