# useCodeMirror Architecture

This document describes the architecture of the `useCodeMirror` React hook, which integrates CodeMirror 6 with React components in mdxpad.

---

## Table of Contents

1. [Hook Lifecycle](#hook-lifecycle)
2. [Extension Composition Order](#extension-composition-order)
3. [Theme Switching Mechanism](#theme-switching-mechanism)
4. [State Flow Diagram](#state-flow-diagram)
5. [Compartment Usage](#compartment-usage)
6. [Technical Details](#technical-details)

---

## Hook Lifecycle

### Initialization Phase

When `useCodeMirror` is called, the following sequence occurs:

1. **Refs and State Setup**
   ```
   containerRef  -> useRef<HTMLDivElement | null>(null)
   viewRef       -> useRef<EditorView | null>(null)
   onErrorRef    -> useRef<OnErrorCallback | undefined>(options.onError)
   state         -> useState<EditorState | null>(null)
   selection     -> useState<SelectionInfo | null>(null)
   isFocused     -> useState<boolean>(false)
   ```

2. **Mount Effect** (`useEffect` with empty deps `[]`)
   - Waits for `containerRef.current` to be available (DOM ready)
   - Calls `initializeEditor()` which:
     a. Creates debounced `onChange` handler (default 150ms)
     b. Calls `buildExtensions()` to get extensions + per-instance theme compartment
     c. Creates `EditorView.updateListener` for state synchronization
     d. Instantiates `EditorView` with initial state
     e. Stores view reference in `viewRef.current`
     f. Sets initial React state from CodeMirror state
     g. Sets up theme listener for system preference changes (if `theme: 'system'`)

3. **Callback Memoization**
   - `setValue`, `setSelection`, `executeCommand`, `focus` are wrapped in `useCallback`
   - Each depends only on stable refs, avoiding unnecessary re-renders

### State Management During Runtime

The hook maintains a clear separation between:

- **CodeMirror State** (source of truth): The `EditorView` instance owns all editor state
- **React State** (derived snapshots): `state`, `selection`, and `isFocused` are read-only snapshots

State flows one direction: CodeMirror -> React. The React state is never written back to CodeMirror except through explicit user actions (`setValue`, `setSelection`, `executeCommand`).

### Cleanup on Unmount

When the component unmounts, the cleanup function returned by `initializeEditor()` executes:

```
1. debouncedOnChange?.cancel()     // Prevent stale callbacks
2. cleanupThemeListener()          // Remove media query listener
3. view.destroy()                  // Destroy CodeMirror instance
4. viewRef.current = null          // Clear ref
```

**Why this order matters:**
- Debounced callbacks are cancelled first to prevent them from firing during destruction
- Theme listener cleanup removes the `matchMedia` event listener before the view is destroyed
- `view.destroy()` removes DOM elements and cleans up internal subscriptions
- Setting ref to null prevents any stale references from being used

---

## Extension Composition Order

The `buildExtensions()` function composes extensions in a specific order. **Order matters** because later extensions can override or modify behavior from earlier ones.

### Extension Stack (Top to Bottom)

```
1. CORE EDITING (always enabled)
   ├── highlightSpecialChars()    // Show invisible characters
   ├── history()                  // Undo/redo support
   ├── drawSelection()            // Selection rendering
   ├── dropCursor()               // Drag-and-drop cursor
   ├── crosshairCursor()          // Precise cursor positioning
   └── rectangularSelection()     // Alt+drag selection

2. LANGUAGE SUPPORT
   └── mdxLanguage()              // MDX syntax highlighting

3. THEME (in compartment)
   └── themeCompartment.of(getThemeExtension(theme))

4. VISUAL FEATURES (conditionally enabled)
   ├── lineNumbers()              // if lineNumbers: true
   ├── EditorView.lineWrapping    // if lineWrapping: true
   ├── highlightActiveLine()      // if highlightActiveLine: true
   ├── bracketMatching()          // if bracketMatching: true
   ├── closeBrackets()            // if closeBrackets: true
   └── indentationMarkers()       // if indentationGuides: true

5. INDENTATION
   └── indentUnit.of(...)         // Tab size configuration

6. SEARCH
   └── search()                   // Find/replace functionality

7. KEYMAPS (combined, last position)
   └── keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap])
```

### Why Order Matters

1. **Core editing first**: Ensures basic functionality is available before any dependent extensions load

2. **Language before theme**: Syntax highlighting tokens must be defined before theme styles apply to them

3. **Theme in compartment**: Placed early enough to style all subsequent visual elements, but in a compartment for dynamic reconfiguration

4. **Visual features after theme**: They inherit theme colors and can be styled consistently

5. **Keymaps last**: Ensures our keybindings take precedence. Later keymaps can shadow earlier ones for overlapping keys.

### Markdown Keymap (Separate, High Precedence)

The `markdownKeymap` is added separately in `useCodeMirror.ts` (not in `buildExtensions`):

```typescript
extensions: [...configExtensions, markdownKeymap, updateListener]
```

It uses `Prec.high()` wrapper to ensure markdown-specific keybindings (Mod-b for bold, etc.) override default bindings.

---

## Theme Switching Mechanism

### The Compartment Pattern

CodeMirror 6 uses **Compartments** to isolate extension subsets that can be reconfigured at runtime without rebuilding the entire editor state.

```
┌─────────────────────────────────────────────────────────┐
│                    EditorState                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Static Extensions (immutable after creation)      │ │
│  │  - history(), highlightSpecialChars(), etc.        │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Theme Compartment (reconfigurable)                │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │  lightTheme OR darkTheme (swappable)         │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Theme Switching Flow

1. **Initial Setup** (`themes.ts`):
   ```typescript
   // Create compartment per editor instance
   const themeCompartment = createThemeCompartment(); // new Compartment()

   // Wrap theme in compartment
   extensions.push(themeCompartment.of(getThemeExtension(opts.theme)));
   ```

2. **System Theme Detection**:
   ```typescript
   function getSystemTheme(): 'light' | 'dark' {
     return window.matchMedia('(prefers-color-scheme: dark)').matches
       ? 'dark'
       : 'light';
   }
   ```

3. **Runtime Theme Switch** (`createThemeListener`):
   ```typescript
   const handler = (e: MediaQueryListEvent): void => {
     view.dispatch({
       effects: compartment.reconfigure(e.matches ? darkTheme : lightTheme),
     });
   };

   mediaQuery.addEventListener('change', handler);
   ```

### Why Compartments for Themes

- **No state loss**: Switching themes doesn't reset undo history, cursor position, or other editor state
- **Efficient**: Only the theme extension is replaced, not the entire extension stack
- **Atomic**: Theme change happens in a single transaction

---

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           React Component                                    │
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │  state           │    │  selection       │    │  isFocused       │       │
│  │  (EditorState)   │    │  (SelectionInfo) │    │  (boolean)       │       │
│  └────────▲─────────┘    └────────▲─────────┘    └────────▲─────────┘       │
│           │                       │                       │                  │
│           │              READ-ONLY SNAPSHOTS              │                  │
│           └───────────────────────┼───────────────────────┘                  │
│                                   │                                          │
│  ┌────────────────────────────────┼────────────────────────────────────────┐ │
│  │                     updateListener                                      │ │
│  │                                                                         │ │
│  │  EditorView.updateListener.of((update) => {                            │ │
│  │    if (update.docChanged) {                                            │ │
│  │      setState(toEditorState(update.state));        // sync doc         │ │
│  │      debouncedOnChange?.call(newState);            // notify (150ms)   │ │
│  │    }                                                                   │ │
│  │    if (update.selectionSet) {                                          │ │
│  │      setSelection(toSelectionInfo(...));           // sync selection   │ │
│  │      onSelectionChange?.(newSelection);            // notify (sync)    │ │
│  │    }                                                                   │ │
│  │    setIsFocused(update.view.hasFocus);             // sync focus       │ │
│  │  });                                                                   │ │
│  └────────────────────────────────▲────────────────────────────────────────┘ │
│                                   │                                          │
│                         CODEMIRROR UPDATES                                   │
│                                   │                                          │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼──────────────────────────────────────────┐
│                                   │                                          │
│                        CodeMirror EditorView                                 │
│                     (SOURCE OF TRUTH FOR ALL STATE)                          │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         EditorState                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ doc         │  │ selection   │  │ history     │  │ extensions  │  │   │
│  │  │ (Text)      │  │ (ranges)    │  │ (undo/redo) │  │ (facets)    │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                   ▲                                          │
│                                   │                                          │
│                    view.dispatch({ changes, selection, effects })            │
│                                   │                                          │
│  ┌────────────────────────────────┴────────────────────────────────────────┐ │
│  │                        User Actions                                     │ │
│  │                                                                         │ │
│  │   setValue(value)        -> dispatch({ changes: { from, to, insert } }) │ │
│  │   setSelection(a, h)     -> dispatch({ selection: { anchor, head } })   │ │
│  │   executeCommand('bold') -> dispatch({ changes, selection })            │ │
│  │   Keyboard input         -> (handled by CodeMirror internally)          │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key Points

1. **Single Source of Truth**: CodeMirror's `EditorState` is the canonical state
2. **Unidirectional Flow**: Changes flow from CodeMirror -> React (never React -> CodeMirror directly)
3. **React State is Derived**: `state`, `selection`, `isFocused` are snapshots, not sources
4. **Imperative Updates**: `setValue`, `setSelection` dispatch transactions to CodeMirror

---

## Compartment Usage

### What is a Compartment?

A `Compartment` is a CodeMirror construct that wraps an extension (or set of extensions) to allow runtime reconfiguration. Without compartments, changing an extension would require recreating the entire editor state.

```typescript
import { Compartment } from '@codemirror/state';

const themeCompartment = new Compartment();

// Initial setup
const extensions = [
  themeCompartment.of(lightTheme),  // Wrap theme in compartment
  // ... other extensions
];

// Later, to switch themes:
view.dispatch({
  effects: themeCompartment.reconfigure(darkTheme)
});
```

### Per-Instance Compartments

**Critical**: Each editor instance MUST have its own compartment instance.

```typescript
// WRONG - Singleton compartment (shared across editors)
const globalThemeCompartment = new Compartment();

// CORRECT - Per-instance compartment
export function createThemeCompartment(): Compartment {
  return new Compartment();
}
```

### Why Per-Instance Matters

If multiple editors share a compartment, reconfiguring one affects all:

```
┌──────────────────────────────────────────────────────────────┐
│  SHARED COMPARTMENT (WRONG)                                  │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │  Editor A   │    │  Editor B   │    │  Editor C   │      │
│  │             │    │             │    │             │      │
│  │  compartment.of(darkTheme) ◄────────────────────────┐    │
│  │             │    │             │    │             │  │    │
│  └─────────────┘    └─────────────┘    └─────────────┘  │    │
│                                                         │    │
│       Editor B calls: compartment.reconfigure(light)────┘    │
│       Result: ALL editors switch to light theme!             │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  PER-INSTANCE COMPARTMENTS (CORRECT)                         │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │  Editor A   │    │  Editor B   │    │  Editor C   │      │
│  │             │    │             │    │             │      │
│  │  compA.of   │    │  compB.of   │    │  compC.of   │      │
│  │  (dark)     │    │  (light)    │    │  (system)   │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│                           │                                  │
│       Editor B calls: compB.reconfigure(dark)                │
│       Result: Only Editor B changes theme                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Implementation in useCodeMirror

```typescript
// extensions.ts
export function buildExtensions(config): EditorExtensionsResult {
  // Create per-instance compartment
  const themeCompartment = createThemeCompartment();

  // ... build extensions ...
  extensions.push(themeCompartment.of(getThemeExtension(opts.theme)));

  // Return both extensions AND the compartment
  return { extensions, themeCompartment };
}

// useCodeMirror.ts
function initializeEditor(...) {
  // Destructure to get per-instance compartment
  const { extensions: configExtensions, themeCompartment } = buildExtensions(...);

  // Pass compartment to theme listener for runtime switching
  const cleanupThemeListener = createThemeListener(view, themeCompartment, options.theme ?? 'system');

  // ...
}
```

---

## Technical Details

### Why CodeMirror Owns All Editor State

Per Constitution Article III Section 3.4:

> CodeMirror 6 MUST own all editor state. MUST NOT duplicate editor state in React state.

**Rationale:**

1. **Performance**: CodeMirror's internal state management is highly optimized for text editing. Mirroring state in React would double memory usage and add synchronization overhead.

2. **Consistency**: A single source of truth eliminates synchronization bugs. React state becoming out of sync with CodeMirror state would cause subtle, hard-to-debug issues.

3. **Transactional Updates**: CodeMirror's transaction system guarantees atomic updates. If we maintained parallel React state, we'd need to replicate this transactional behavior.

4. **Extension Compatibility**: CodeMirror extensions expect state to live in EditorState. Custom React state wouldn't integrate with the extension ecosystem.

### The Debounced onChange Pattern

```typescript
const debouncedOnChange = options.onChange
  ? debounce(options.onChange, options.debounceMs ?? DEFAULT_DEBOUNCE_MS)
  : undefined;
```

**Why Debounce:**

1. **Keystroke Performance**: Every keystroke triggers an `updateListener` callback. Without debouncing, expensive `onChange` handlers (e.g., saving to disk, updating preview) would fire on every keystroke.

2. **Batching**: Rapid edits (e.g., typing "hello") generate 5 separate updates. Debouncing batches these into a single callback after typing pauses.

3. **Budget Compliance**: Constitution Article V requires `<16ms` keystroke latency. Synchronous `onChange` callbacks could easily exceed this. Debouncing defers work.

**Default: 150ms** - Chosen to balance responsiveness with batching. Users can customize via `debounceMs` option.

**Note**: `onSelectionChange` is NOT debounced because:
- Selection changes are less frequent than document changes
- UI feedback for selection (cursor position, selection highlight) should be immediate

### State Synchronization with React

The `updateListener` synchronizes CodeMirror state to React state:

```typescript
EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    const newState = toEditorState(update.state);
    setState(newState);                    // Sync to React
    debouncedOnChange?.call(newState);     // Notify consumer (debounced)
  }
  if (update.selectionSet) {
    const newSelection = toSelectionInfo(anchor, head);
    setSelection(newSelection);            // Sync to React
    onSelectionChange?.(newSelection);     // Notify consumer (immediate)
  }
  setIsFocused(update.view.hasFocus);      // Always sync focus
});
```

**State Conversion Functions** (`state-bridge.ts`):

```typescript
// Convert CodeMirror state to shared EditorState type
export function toEditorState(cmState: CMEditorState): EditorState {
  const { main } = cmState.selection;
  return {
    doc: cmState.doc.toString(),
    selection: { anchor: main.anchor, head: main.head },
  };
}

// Create SelectionInfo with computed properties
export function toSelectionInfo(anchor: number, head: number): SelectionInfo {
  return {
    from: Math.min(anchor, head),
    to: Math.max(anchor, head),
    empty: anchor === head,
  };
}
```

These functions produce plain objects that are:
- Serializable (no CodeMirror internal references)
- Immutable (readonly snapshots)
- Type-safe (conform to shared interfaces)

---

## File Structure

```
src/renderer/hooks/useCodeMirror/
├── index.ts              # Public exports
├── useCodeMirror.ts      # Main hook implementation
├── extensions.ts         # Extension composition
├── themes.ts             # Theme definitions and switching
├── commands.ts           # Editor commands and keybindings
├── ARCHITECTURE.md       # This document
├── useCodeMirror.test.ts # Hook tests
└── __tests__/
    ├── commands.test.ts
    ├── extensions.test.ts
    └── themes.test.ts
```

---

## Related Documentation

- **Constitution Article III Section 3.4**: Editor Architecture requirements
- **Constitution Article VII Section 7.1**: Platform Integration (theme support)
- **`src/renderer/lib/editor/state-bridge.ts`**: State conversion utilities
- **`src/shared/types/editor.ts`**: Shared type definitions
