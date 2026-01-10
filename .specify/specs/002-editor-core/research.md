# Research: Editor Core (002)

**Date**: 2026-01-09
**Feature**: CodeMirror 6 integration for MDX editing

## Package Versions (Verified via npm Registry)

All versions confirmed current as of 2026-01-09:

| Package | Version | Purpose |
|---------|---------|---------|
| `@codemirror/state` | 6.5.3 | Core state management, Compartment, Extension |
| `@codemirror/view` | 6.39.9 | EditorView, keymap, DOM integration |
| `@codemirror/commands` | 6.10.1 | Default keymaps, history, editing commands |
| `@codemirror/language` | 6.12.1 | Syntax highlighting infrastructure |
| `@codemirror/language-data` | 6.5.2 | Pre-configured language descriptions |
| `@codemirror/lang-markdown` | 6.5.0 | Markdown language support |
| `@codemirror/lang-javascript` | 6.2.4 | JavaScript/JSX/TypeScript support |
| `@codemirror/lang-yaml` | 6.1.2 | YAML + yamlFrontmatter() |
| `@codemirror/search` | 6.5.11 | Find/replace functionality |
| `@codemirror/autocomplete` | 6.20.0 | Autocompletion |
| `@codemirror/theme-one-dark` | 6.1.3 | Dark theme |
| `@lezer/highlight` | 1.2.3 | Syntax highlighting tags |
| `@lezer/markdown` | 1.6.3 | Markdown parser |

---

## Decision 1: MDX Syntax Highlighting Approach

**Decision**: Extend `@codemirror/lang-markdown` with JSX support via `defaultCodeLanguage` and `codeLanguages` configuration.

**Rationale**:
- `markdown()` function accepts `defaultCodeLanguage` for inline code/expressions
- `codeLanguages` array enables language-specific highlighting in fenced code blocks
- This follows CodeMirror 6 idioms per Constitution Article III Section 3.4
- No custom Lezer parser needed for basic MDX support

**Alternatives Considered**:
- Custom Lezer parser for full MDX inline JSX parsing: Too complex for MVP, deferred
- Separate MDX language package: None exists with CodeMirror 6 support

**Implementation Pattern**:
```typescript
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { languages } from '@codemirror/language-data';

export function mdxLanguage() {
  return markdown({
    base: markdownLanguage,
    defaultCodeLanguage: javascript({ jsx: true, typescript: true }),
    codeLanguages: languages,
    completeHTMLTags: true,
  });
}
```

---

## Decision 2: Frontmatter (YAML) Support

**Decision**: Use `yamlFrontmatter()` from `@codemirror/lang-yaml` v6.1.2.

**Rationale**:
- Built-in support for YAML between `---` delimiters at document start
- Wraps the markdown language support cleanly
- No custom parsing required

**Alternatives Considered**:
- Custom regex-based frontmatter detection: Fragile, inconsistent with CodeMirror patterns
- Manual parser extension: Unnecessary given built-in support

**Implementation Pattern**:
```typescript
import { yamlFrontmatter } from '@codemirror/lang-yaml';

export function mdxWithFrontmatter() {
  return yamlFrontmatter({
    content: mdxLanguage()
  });
}
```

---

## Decision 3: React Integration Strategy

**Decision**: Build a custom React hook using CodeMirror primitives directly (not `@uiw/react-codemirror`).

**Rationale**:
- Constitution Article III Section 3.4 requires CodeMirror to own all editor state
- Custom hook provides full control over extension composition
- Avoids external dependency for core editor functionality
- Enables proper cleanup and ref management
- Compartments enable dynamic theme switching

**Alternatives Considered**:
- `@uiw/react-codemirror`: Adds dependency, less control over internals
- Class component wrapper: Not aligned with React 19 patterns

**Implementation Pattern**:
```typescript
export function useCodeMirror(options: CodeMirrorOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());

  useEffect(() => {
    // Initialize EditorView with extensions
    // Return cleanup function
  }, []);

  return { containerRef, view: viewRef };
}
```

---

## Decision 4: Custom Keyboard Commands

**Decision**: Create custom commands as functions with signature `(view: EditorView) => boolean`, registered via `keymap.of([])`.

**Rationale**:
- Standard CodeMirror 6 pattern
- `Mod-` prefix automatically maps Cmd (Mac) / Ctrl (Windows/Linux)
- Commands compose cleanly with default keymaps
- `Prec.high()` allows overriding default bindings

**Implementation Pattern**:
```typescript
import { keymap, EditorView } from '@codemirror/view';
import { Prec } from '@codemirror/state';

const toggleBold = (view: EditorView): boolean => {
  const { from, to } = view.state.selection.main;
  const text = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `**${text}**` },
    selection: { anchor: from + 2, head: to + 2 },
  });
  return true;
};

export const markdownKeymap = Prec.high(keymap.of([
  { key: 'Mod-b', run: toggleBold },
  { key: 'Mod-i', run: toggleItalic },
  // ...
]));
```

---

## Decision 5: Change Events with Debouncing

**Decision**: Use `EditorView.updateListener.of()` with external debounce utility.

**Rationale**:
- Clean separation of concerns
- Debounce delay configurable via props (default 150ms per spec)
- Checks `update.docChanged` to avoid spurious events
- Aligns with React patterns for controlled components

**Implementation Pattern**:
```typescript
function createChangeListener(
  onChange: (doc: string) => void,
  debounceMs: number
): Extension {
  const debounced = debounce(onChange, debounceMs);
  return EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      debounced(update.state.doc.toString());
    }
  });
}
```

---

## Decision 6: Theme Support (Light/Dark)

**Decision**: Use `Compartment` for dynamic theme switching with `prefers-color-scheme` media query listener.

**Rationale**:
- Constitution Article VII Section 7.1 requires system theme support
- Compartments allow runtime reconfiguration without full editor rebuild
- Media query listener enables automatic switching
- Supports both system preference and manual override

**Implementation Pattern**:
```typescript
const themeCompartment = new Compartment();

// Listen for system changes
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
mediaQuery.addEventListener('change', (e) => {
  view.dispatch({
    effects: themeCompartment.reconfigure(
      e.matches ? oneDark : lightTheme
    )
  });
});
```

---

## Decision 7: Error Handling (per Clarification)

**Decision**: Log to console AND emit structured error events.

**Rationale**:
- Immediate debugging via console (development)
- Structured events enable future telemetry integration
- Graceful degradation per Constitution Article VII Section 7.3

**Implementation Pattern**:
```typescript
export interface EditorError {
  readonly type: 'syntax' | 'command' | 'extension';
  readonly message: string;
  readonly timestamp: number;
  readonly context?: Record<string, unknown>;
}

// Emit via custom event or callback
type OnError = (error: EditorError) => void;
```

---

## Constitution Compliance Notes

| Article | Requirement | Status |
|---------|-------------|--------|
| II | TypeScript 5.9.x strict: true | VERIFIED - existing tsconfig |
| II | React 19.x | VERIFIED - existing package.json |
| II | CodeMirror 6.x | VERIFIED - packages above are 6.x |
| III.4 | CodeMirror owns all editor state | COMPLIANT - custom hook pattern |
| III.4 | Extensions follow CM idioms | COMPLIANT - Extension/Facet/StateField |
| III.4 | MDX extends lang-markdown with JSX | COMPLIANT - yamlFrontmatter + markdown + jsx |
| V | Keystroke latency < 16ms | TBD - validate with benchmark |
| VI.1 | strict: true, JSDoc for public APIs | PLANNED |
| VII.1 | System light/dark mode | COMPLIANT - Compartment + media query |

---

## Open Questions (Resolved)

All research questions resolved. No NEEDS CLARIFICATION remaining.
