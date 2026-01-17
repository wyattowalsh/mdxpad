# Research: Keyboard Shortcuts & Command Palette

**Feature Branch**: `005-command-palette`
**Date**: 2026-01-10
**Status**: Complete

## Overview

This document captures research findings for implementing the keyboard shortcuts system and command palette for mdxpad. Research was conducted across 6 parallel tracks.

---

## 1. Command Registry Architecture (Zustand 5.x)

### Decision
Use Zustand 5.x with `immer` middleware for the command registry store, following the established pattern from `preview-store.ts`.

### Key Patterns

**Store Structure:**
```typescript
// Follows existing preview-store.ts pattern
interface CommandRegistryState {
  readonly commands: Map<CommandId, Command>;
  readonly commandStates: Map<CommandId, CommandState>;
  readonly shortcutIndex: Map<string, CommandId>;
  readonly conflicts: ReadonlyArray<ShortcutConflict>;
}

interface CommandRegistryActions {
  register: <TPayload>(command: Command<TPayload>) => void;
  unregister: (id: CommandId) => void;
  setEnabled: (id: CommandId, enabled: boolean) => void;
  execute: <TPayload>(id: CommandId, payload?: TPayload) => Promise<boolean>;
}
```

**Branded Types for Type Safety:**
```typescript
export type CommandId = string & { readonly __brand: 'CommandId' };
```

**Key Idioms:**
1. Use curried `create<Type>()()` pattern for TypeScript inference
2. Wrap with `subscribeWithSelector` for granular reactive updates
3. Use `immer` middleware for ergonomic Map/Set mutations
4. Separate state interface from actions interface
5. Export bounded hooks with built-in selectors

### Rationale
- Consistent with existing codebase patterns (`preview-store.ts`)
- Constitution Article II mandates Zustand 5.x
- Immer enables immutable updates with mutable syntax
- `subscribeWithSelector` enables external subscription (e.g., for analytics)

### Alternatives Rejected
| Alternative | Rejection Reason |
|-------------|------------------|
| Redux | Overkill for local state; Constitution specifies Zustand |
| Context API | No persistence, harder to test, less reactive |
| MobX | Not in tech stack |
| Class-based singleton | React integration patterns favor hooks |

---

## 2. Fuzzy Search Algorithm

### Decision
Implement a custom VS Code-style fuzzy search algorithm (~85 lines) with no external dependencies.

### Algorithm Design

**Scoring System:**
| Factor | Bonus | Rationale |
|--------|-------|-----------|
| Consecutive match | +5 × streak length | Rewards typing exact substrings |
| Word boundary start | +10 | Matches at start of words |
| CamelCase boundary | +8 | Capital letters in camelCase |
| First character match | Included in boundary | Query starts at target start |
| Base match | +1 | Any character matched |
| Gap penalty | -0.5 per char | Skipped characters reduce score |

**Core Function Signature:**
```typescript
export interface FuzzyMatchResult<T = string> {
  item: T;
  score: number;
  matches: number[];  // Indices for highlighting
}

export function fuzzyMatch(query: string, target: string): FuzzyMatchResult | null;
export function fuzzySearch<T>(query: string, items: T[], accessor?: (item: T) => string): FuzzyMatchResult<T>[];
export function highlightMatches(text: string, matches: number[]): HighlightSegment[];
```

**Performance Analysis:**
- 100 commands × 30 chars = 3,000 comparisons per keystroke
- Executes in <1ms on modern hardware
- No debouncing required at this scale
- No caching needed

### Rationale
- Constitution Article V requires bundle < 5MB (no heavy dependencies)
- Spec FR-006 requires fuzzy search with character highlighting
- VS Code-style matching provides familiar UX
- ~85 lines fits "no external shortcut libraries" requirement

### Alternatives Rejected
| Alternative | Rejection Reason |
|-------------|------------------|
| Fuse.js | 23KB gzipped, overkill for 100 items |
| fuzzysort | External dependency, larger than needed |
| Simple includes() | No scoring, no match positions |
| Levenshtein distance | Wrong algorithm (edit distance vs subsequence) |

---

## 3. Electron Menu Integration

### Decision
Extend existing menu system in `/src/main/menu.ts` with command palette accelerator and use `webContents.send()` for menu-to-renderer communication.

### Integration Pattern

**Menu Event Pattern (established):**
```typescript
// In menu.ts - sends event to renderer
{
  label: 'Command Palette...',
  accelerator: 'CmdOrCtrl+Shift+P',
  click: () => window.webContents.send('mdxpad:menu:command-palette'),
}
```

**Renderer Listener:**
```typescript
// In renderer - listen for menu events via preload
window.mdxpadAPI.onMenuCommandPalette(() => {
  commandPaletteStore.getState().open();
});
```

**Existing Menu Events to Reuse:**
- `'mdxpad:menu:new-file'` → File > New
- `'mdxpad:menu:open-file-dialog'` → File > Open
- `'mdxpad:menu:save-file'` → File > Save
- `'mdxpad:menu:save-file-as'` → File > Save As

### Accelerator Format
Platform-aware shortcuts use `CmdOrCtrl` prefix:
- `CmdOrCtrl+N` → Cmd+N on macOS, Ctrl+N on Windows/Linux
- `CmdOrCtrl+Shift+P` → Cmd+Shift+P on macOS, Ctrl+Shift+P on Windows/Linux

### Rationale
- Constitution Article VII.1 requires native macOS menu bar
- Existing pattern in codebase is proven and working
- Accelerators sync native menu with app-level shortcuts

---

## 4. CodeMirror 6 Command Dispatch

### Decision
Use existing `executeCommand()` pattern from `/src/renderer/hooks/useCodeMirror/commands.ts` with `view.dispatch()` for editor operations.

### Existing Implementation (commands.ts)

**EditorView.dispatch Pattern:**
```typescript
// Already implemented in codebase
view.dispatch({
  changes: { from, to, insert: newText },
  selection: { anchor: newPos, head: newPos },
});
```

**Existing Commands:**
- `bold` → `**text**`
- `italic` → `*text*`
- `code` → `` `text` ``
- `link` → `[text](url)`
- `heading1/2/3` → `# text`
- `undo/redo` → History commands
- `find/findReplace/goToLine` → Search panel commands

**Access Pattern:**
```typescript
// getView() escape hatch already exposed
const { getView } = useCodeMirror(containerRef, { ... });

// Execute command programmatically
const view = getView();
if (view) executeCommand(view, 'bold');
```

### Commands to Add
| Command | Shortcut | Implementation |
|---------|----------|----------------|
| insertCodeBlock | Cmd+Shift+K | Insert ``` block at line start |
| toggleComment | Cmd+/ | Use @codemirror/commands toggleComment |

### Rationale
- Leverage existing command infrastructure
- No changes to editor architecture needed
- Commands already tested with 1200+ lines of tests

---

## 5. Accessibility Patterns

### Decision
Implement command palette as ARIA combobox with listbox popup, using React-based focus trap without external dependencies.

### ARIA Structure

```html
<div role="combobox" aria-expanded="true" aria-haspopup="listbox" aria-owns="command-list">
  <input
    type="text"
    aria-autocomplete="list"
    aria-controls="command-list"
    aria-activedescendant="command-3"
  />
</div>
<ul role="listbox" id="command-list">
  <li role="option" id="command-1" aria-selected="false">Save</li>
  <li role="option" id="command-2" aria-selected="false">Open</li>
  <li role="option" id="command-3" aria-selected="true">New</li>
</ul>
```

### Keyboard Navigation
| Key | Action |
|-----|--------|
| ↓ / ↑ | Navigate options |
| Enter | Execute selected command |
| Escape | Close palette |
| Tab | Move to next element (trapped in modal) |

### Focus Trap Implementation (~30 lines)

```typescript
function useFocusTrap(containerRef: RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const container = containerRef.current;
    const focusables = container.querySelectorAll<HTMLElement>(focusableSelector);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    first?.focus();

    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, isActive]);
}
```

### Screen Reader Announcements (FR-043)
```typescript
// aria-live region for command results
<div aria-live="polite" className="sr-only">
  {lastAnnouncement}
</div>

// Announce: "File saved" or "Command failed: reason"
```

### Rationale
- Constitution Article VII.2 requires keyboard navigation and focus indicators
- WCAG AA compliance (4.5:1 contrast)
- No external focus-trap library needed

---

## 6. Existing Codebase Integration Points

### IPC Architecture

**Channel Naming Convention:** `mdxpad:{domain}:{action}`

**Existing Channels to Wire:**
```typescript
IPC_CHANNELS = {
  file: {
    open: 'mdxpad:file:open',      // FR-018
    save: 'mdxpad:file:save',      // FR-016
    saveAs: 'mdxpad:file:save-as', // FR-017
  },
  window: {
    close: 'mdxpad:window:close',  // FR-020
  },
}
```

**Menu Events (renderer receives via preload):**
- `'mdxpad:menu:new-file'` → Already wired
- `'mdxpad:menu:open-file-dialog'` → Already wired
- `'mdxpad:menu:save-file'` → Already wired
- `'mdxpad:menu:save-file-as'` → Already wired

### Store Patterns

**Existing Zustand Pattern (preview-store.ts):**
- Separate State and Actions interfaces
- Use `immer` middleware for mutations
- Export typed selectors
- `readonly` properties for state

### Preload API

**Current API Surface:**
```typescript
// From /src/preload/api.ts
interface MdxpadAPI {
  openFile: () => Promise<FileOpenResult>;
  saveFile: (fileId: string, content: string) => Promise<FileSaveResult>;
  saveFileAs: (content: string) => Promise<FileSaveAsResult>;
  // ... window operations
}
```

### New Integration Needed

**New Store:** `command-registry-store.ts`
- Register built-in commands on app init
- Subscribe to store for conflict detection

**New UI Store:** `ui-layout-store.ts` (per spec clarification)
- Separate from compile-focused `previewStore`
- Manages: `previewVisible`, `sidebarVisible`, `zoomLevel`

**Preload Extension:**
```typescript
// Add to MdxpadAPI
onMenuCommandPalette: (callback: () => void) => void;
onMenuEvent: (event: string, callback: () => void) => void;
```

---

## Clarifications Resolved

From spec session 2026-01-10:

| Question | Resolution |
|----------|------------|
| Preview toggle state | New `uiLayoutStore` for UI-only state |
| Command.execute signature | `(ctx: CommandContext) => CommandResult \| Promise<CommandResult>` |
| Notification system | Future-proof data model, ship ToastStack UI only |
| Placeholder commands | Register as disabled with "Coming soon" badge |
| Fuzzy search algorithm | VS Code-style character match with scoring |
| Rapid shortcut presses | 200ms debounce, "in progress" indicator |
| Screen reader results | aria-live region for success/failure |
| Zoom bounds | 50%-200% range |
| Zoom persistence | localStorage, restore on launch |

---

## File Locations Summary

| New File | Purpose |
|----------|---------|
| `/src/renderer/stores/command-registry-store.ts` | Command registry singleton |
| `/src/renderer/stores/ui-layout-store.ts` | UI panel visibility state |
| `/src/renderer/lib/fuzzy-search.ts` | Fuzzy search algorithm |
| `/src/renderer/components/CommandPalette/` | Palette component + hooks |
| `/src/shared/types/commands.ts` | Command type definitions |
| `/src/main/menu.ts` (modify) | Add palette accelerator |
| `/src/preload/api.ts` (modify) | Add menu event listener |

---

## References

1. VS Code fuzzyScorer.ts: https://github.com/microsoft/vscode/blob/main/src/vs/base/common/fuzzyScorer.ts
2. Zustand 5.x docs: https://zustand.docs.pmnd.rs/
3. WAI-ARIA Combobox: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
4. CodeMirror 6 commands: https://codemirror.net/docs/ref/#commands
5. Electron Menu API: https://www.electronjs.org/docs/latest/api/menu
