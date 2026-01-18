# Phase 0 Research: Smart Filtering for File Tree

**Date**: 2026-01-17
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Research Summary

Three research tracks completed in parallel:

| Track | Decision | Key Finding |
|-------|----------|-------------|
| Fuzzy Library | `fzf` (fzf-for-js) | True fzf-style matching with position indices |
| Persistence | Hash-based localStorage | `mdxpad:filter:query:<8-char-hash>` pattern |
| Keyboard Shortcuts | React + Menu accelerator | **Conflict**: `Mod+Shift+F` already used by Find/Replace |

---

## 1. Fuzzy Matching Library

### Decision: `fzf` (fzf-for-js)

**Package**: `npm install fzf`
**Version**: 0.5.2 | **Size**: ~5-7KB minified | **Stars**: 947

### Why `fzf`

1. **True fzf-style sequential matching** - Direct port of fzf algorithm
2. **Match positions for highlighting** - Returns `positions` Set<number>
3. **Native TypeScript** - 79.7% TypeScript, ships with types
4. **Zero dependencies** - No external runtime deps
5. **Smart-case search** - Lowercase = case-insensitive, uppercase = case-sensitive
6. **Performance** - Suitable for 10,000+ items

### API Pattern

```typescript
import { Fzf, FzfResultItem } from 'fzf';

interface FileEntry {
  path: string;
  name: string;
}

const fzf = new Fzf<FileEntry>(files, {
  selector: (item) => item.path,
  casing: 'smart-case',
  tiebreakers: [
    (a, b, selector) => selector(a.item).length - selector(b.item).length
  ]
});

const results = fzf.find(query);
// results[0].positions -> Set<number> of matched indices
// results[0].score -> higher = better match
```

### Alternatives Rejected

| Library | Reason |
|---------|--------|
| Fuse.js | Not sequential matching; ~24KB; slower |
| uFuzzy | 3-phase API complexity; not true fzf |
| FlexSearch | No match indices; requires indexing |
| Custom | Unnecessary given fzf availability |

---

## 2. Filter Persistence

### Decision: Hash-based localStorage Keys

**Pattern**: `mdxpad:filter:query:<8-char-hash>`

### Key Generation

```typescript
const FILTER_STORAGE_KEY_PREFIX = 'mdxpad:filter:query:' as const;

function simpleHash(str: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, unsigned
  }
  return hash.toString(16).padStart(8, '0');
}

function getFilterStorageKey(projectPath: string): string {
  return `${FILTER_STORAGE_KEY_PREFIX}${simpleHash(projectPath)}`;
}
```

### Serialization

- **Plain string** - No JSON overhead for simple value
- **Empty query** - Remove key instead of storing empty string

### Error Handling

- Silent fail with empty string fallback
- Filter state is non-critical; app functions without it
- Log warnings for debugging but don't disrupt UX

### Debounce Strategy

- Piggyback on existing 50ms filter debounce (FR-010)
- Single debounce timer for both filtering and persistence

---

## 3. Keyboard Shortcuts

### Decision: React Event Handler + Menu Accelerator

**Primary**: `useKeyboardShortcuts` hook + command registry
**Secondary**: Electron Menu accelerator for discoverability

### Why React-Side Handling

1. Aligns with existing `useKeyboardShortcuts.ts` hook
2. Integrates with `command-registry-store.ts` for conflict detection
3. Direct DOM access via refs for focus management
4. Existing `Mod` abstraction handles platform differences

### Conflict Detected

**`Mod+Shift+F` is already registered for `edit.find-replace`**

Found in `editor-commands.ts`:
```typescript
const findReplaceCommand = createEditorCommand(
  'edit.find-replace' as CommandId,
  'Find and Replace',
  'Open find and replace dialog',
  'findReplace',
  { key: 'f', modifiers: ['Mod', 'Shift'] }  // <-- Conflict!
);
```

### Resolution Options

| Option | Description | Recommendation |
|--------|-------------|----------------|
| 1. Change filter shortcut | Use `Mod+P` (VS Code file finder) | **Recommended** |
| 2. Context-aware | Different behavior per focus | Confusing UX |
| 3. Reassign Find/Replace | Move to `Mod+H` | Breaking change |
| 4. Priority override | Filter takes precedence | Blocks Find/Replace |

**Recommendation**: Use `Mod+P` for filter focus (matches VS Code's "Quick Open" mental model).

### Implementation Pattern

```typescript
// Register command
const focusFilterCommand: Command = {
  id: 'filter.focus' as CommandId,
  name: 'Focus File Filter',
  shortcut: { key: 'p', modifiers: ['Mod'] },
  execute: () => {
    window.dispatchEvent(new CustomEvent('mdxpad:focus-filter'));
    return { ok: true };
  },
};

// Listen in component
useEffect(() => {
  const handleFocusFilter = () => filterInputRef.current?.focus();
  window.addEventListener('mdxpad:focus-filter', handleFocusFilter);
  return () => window.removeEventListener('mdxpad:focus-filter', handleFocusFilter);
}, []);
```

### Input Bypass Modification

Modify `useKeyboardShortcuts.ts` to allow filter focus through input fields:

```typescript
if (target.tagName === 'INPUT' || ...) {
  const isFilterFocus = event.key.toLowerCase() === 'p' && modKey;
  if (event.key !== 'Escape' && !isFilterFocus) return;
}
```

---

## Open Questions for Clarification

1. **Keyboard Shortcut Conflict**: Should we proceed with `Mod+P` or maintain `Mod+Shift+F` and reassign Find/Replace?

---

## References

- Fuzzy library: https://github.com/ajitid/fzf-for-js
- Existing hooks: `src/renderer/hooks/useKeyboardShortcuts.ts`
- Command registry: `src/renderer/stores/command-registry-store.ts`
- UI layout store (persistence pattern): `src/renderer/stores/ui-layout-store.ts`

---

*Research completed: 2026-01-17*
