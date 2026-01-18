# Quickstart: Smart Filtering for File Tree (Spec 014)

**Branch**: `014-smart-filtering` | **Date**: 2026-01-17

---

## Feature Overview

Smart Filtering adds fuzzy search to the file explorer sidebar. Users type a query and the file tree instantly filters to show only matching files/folders. Features include:

- **fzf-style fuzzy matching** - Characters match in sequence, not contiguously ("mcp" matches "MyComponent")
- **Visual highlighting** - Matched characters are highlighted in results
- **Session persistence** - Filter state survives app restarts (per project)
- **Keyboard access** - `Mod+P` focuses the filter input

---

## Quick Setup

### Install Dependencies

```bash
npm install fzf
```

| Package | Version | Purpose |
|---------|---------|---------|
| `fzf` | 0.5.2 | True fzf-style sequential matching with position indices |

---

## Key Files

```text
src/renderer/
├── components/file-explorer/
│   ├── FileTreeFilter.tsx      # Filter input UI component
│   └── FilterHighlight.tsx     # Match highlighting component
├── lib/fuzzy-match/
│   ├── matcher.ts              # Core fuzzy matching logic
│   └── types.ts                # Match result types
└── stores/
    └── file-explorer-store.ts  # Extended with filter state
```

---

## Usage Examples

### 1. Initialize fzf with File List

```typescript
import { Fzf, type FzfResultItem } from 'fzf';

interface FileEntry {
  path: string;
  name: string;
}

const files: FileEntry[] = [
  { path: 'src/MyComponent.tsx', name: 'MyComponent.tsx' },
  { path: 'src/utils/helpers.ts', name: 'helpers.ts' },
];

const fzf = new Fzf<FileEntry>(files, {
  selector: (item) => item.path,
  casing: 'case-insensitive',  // Per FR-003: case-insensitive matching
  tiebreakers: [
    (a, b, selector) => selector(a.item).length - selector(b.item).length,
  ],
});
```

### 2. Filter on User Input

```typescript
function filterFiles(query: string): FzfResultItem<FileEntry>[] {
  if (!query.trim()) return [];
  return fzf.find(query);
}

// Usage with debounce (50ms per FR-010)
const results = filterFiles('mcp');
// results[0].item -> { path: 'src/MyComponent.tsx', ... }
// results[0].score -> higher = better match
// results[0].positions -> Set<number> of matched indices
```

### 3. Highlight Matched Characters

```typescript
import type { FzfResultItem } from 'fzf';

interface HighlightProps {
  text: string;
  positions: Set<number>;
}

function FilterHighlight({ text, positions }: HighlightProps) {
  return (
    <span>
      {text.split('').map((char, i) => (
        <span
          key={i}
          className={positions.has(i) ? 'filter-match' : undefined}
        >
          {char}
        </span>
      ))}
    </span>
  );
}

// CSS
// .filter-match { font-weight: 600; text-decoration: underline; }
```

### 4. Persist Filter State

```typescript
const FILTER_STORAGE_KEY_PREFIX = 'mdxpad:filter:query:' as const;

function simpleHash(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function getFilterStorageKey(projectPath: string): string {
  return `${FILTER_STORAGE_KEY_PREFIX}${simpleHash(projectPath)}`;
}

// Save (piggyback on 50ms debounce)
function saveFilterQuery(projectPath: string, query: string): void {
  const key = getFilterStorageKey(projectPath);
  if (query) {
    localStorage.setItem(key, query);
  } else {
    localStorage.removeItem(key);
  }
}

// Restore on mount
function loadFilterQuery(projectPath: string): string {
  const key = getFilterStorageKey(projectPath);
  return localStorage.getItem(key) ?? '';
}
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Mod+P` | Focus filter input |
| `Escape` | Clear filter (if text) or blur input |

**Note**: The spec originally proposed `Mod+Shift+F`, but that conflicts with the existing Find/Replace command. `Mod+P` aligns with VS Code's "Quick Open" pattern.

### Registering the Shortcut

```typescript
// In command registration
const focusFilterCommand: Command = {
  id: 'filter.focus' as CommandId,
  name: 'Focus File Filter',
  shortcut: { key: 'p', modifiers: ['Mod'] },
  execute: () => {
    window.dispatchEvent(new CustomEvent('mdxpad:focus-filter'));
    return { ok: true };
  },
};

// In FileTreeFilter component
useEffect(() => {
  const handleFocusFilter = () => inputRef.current?.focus();
  window.addEventListener('mdxpad:focus-filter', handleFocusFilter);
  return () => window.removeEventListener('mdxpad:focus-filter', handleFocusFilter);
}, []);
```

---

## Testing

### Unit Tests

```bash
# Run fuzzy matching tests
npm test -- src/renderer/lib/fuzzy-match/matcher.test.ts

# Run filter component tests
npm test -- src/renderer/components/file-explorer/FileTreeFilter.test.ts
```

Key test cases:
- Sequential matching: "mcp" matches "MyComponent.tsx"
- Case insensitivity: "MYCOMP" matches "MyComponent.tsx"
- No match returns empty array
- Match positions are correct for highlighting

### E2E Tests

```bash
# Run filter E2E tests
npx playwright test tests/e2e/file-tree-filter.spec.ts
```

Key E2E scenarios:
- Filter input appears and receives focus on `Mod+P`
- Typing filters the file tree in real-time
- Matched characters are visually highlighted
- Filter persists after app restart
- Escape clears filter text

---

## Performance Targets

| Metric | Target | Source |
|--------|--------|--------|
| Filter response | <100ms for 10,000 files | SC-002 |
| Debounce | 50ms after last keystroke | FR-010 |
| Keystroke latency | <16ms p99 | Constitution Article V |

---

*See [spec.md](./spec.md) for full requirements and [plan.md](./plan.md) for architecture details.*
