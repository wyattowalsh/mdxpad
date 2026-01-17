# Research: Settings Persistence in Electron/React Application

**Date**: 2026-01-10
**Project**: mdxpad
**Context**: Command Palette (Spec 005) and Application Shell (Spec 006)

---

## Decision: Hybrid Approach

**Use both `localStorage` and `electron-store`, with clear separation by domain:**

| Storage Backend | Use For | Rationale |
|-----------------|---------|-----------|
| `localStorage` | Renderer-only UI state (panel visibility, zoom level, recent commands, split ratio) | Synchronous, instant access, no IPC overhead |
| `electron-store` | Main process data (recent files, window bounds, file associations) | Atomic writes, JSON Schema validation, accessible from main process |

---

## Rationale

### Why Hybrid Over Pure electron-store

1. **Synchronous Hydration**: `localStorage` is synchronous, enabling settings to be applied before the first React render. This directly addresses the "no flash of default state" requirement (FR-035, SC-003).

2. **No IPC Overhead**: Renderer-only settings (zoom, panel visibility) don't need main process access. Using `localStorage` avoids unnecessary IPC round-trips on every setting change.

3. **Existing Pattern Alignment**: The codebase already uses this hybrid approach:
   - `src/renderer/stores/ui-layout-store.ts` uses `localStorage` for `previewVisible`, `zoomLevel`
   - `src/main/services/recent-files.ts` uses `electron-store` for recent files

4. **Constitution Compliance**: The Constitution does not mandate electron-store for all persistence. It specifies zod for validation (which works with both) and electron-store for file system operations in Spec 004.

### Why Hybrid Over Pure localStorage

1. **Main Process Access**: Settings like recent files and window bounds need main process access (for native menus, window restoration). `localStorage` is not available in the main process.

2. **Data Integrity**: `electron-store` provides atomic writes and JSON Schema validation, important for data that persists across app updates.

3. **Standard Location**: `electron-store` writes to `app.getPath('userData')`, the standard macOS location for app data. `localStorage` is hidden in Chromium's internal storage.

---

## Alternatives Considered

### 1. Pure electron-store (Rejected)

**Pros**:
- Single source of truth
- JSON Schema validation
- Accessible from main process

**Cons**:
- Asynchronous IPC required for renderer access
- Cannot guarantee synchronous load before first render without blocking
- Adds complexity for renderer-only state

**Why Rejected**: The async IPC for reading settings would cause a flash of default state. Workarounds (blocking main process until settings sent) violate Electron best practices.

### 2. Pure localStorage (Rejected)

**Pros**:
- Synchronous access
- Simple API
- Works great with Zustand persist middleware

**Cons**:
- Not accessible from main process
- No schema validation
- Data stored in Chromium internals, not user-accessible

**Why Rejected**: Cannot support recent files in native menu (main process needs the list) or window bounds restoration (main process creates window before renderer loads).

### 3. Zustand persist Middleware with AsyncStorage (Rejected)

**Pros**:
- Built-in Zustand integration
- Automatic serialization

**Cons**:
- Async hydration causes flash of default state
- `skipHydration` + manual rehydrate requires useEffect, still async
- No workaround for synchronous initial render

**Why Rejected**: Zustand persist is designed for async storage (IndexedDB, AsyncStorage). With `localStorage`, the synchronous approach (load before store creation) is simpler and avoids hydration issues.

### 4. IPC Preload Sync Settings (Rejected)

**Pros**:
- Could use electron-store from main process with sync IPC
- Single storage location

**Cons**:
- Sync IPC blocks renderer (violates Electron best practices)
- Adds latency to app startup
- Complex preload API surface

**Why Rejected**: Constitution Section 3.3 requires invoke/handle pattern (async IPC). Sync IPC for settings would be a special exception that sets bad precedent.

---

## Implementation Notes

### 1. Synchronous Initialization Pattern (for localStorage)

The current `ui-layout-store.ts` correctly implements synchronous initialization:

```typescript
// Load persisted state BEFORE store creation
function loadPersistedState(): Partial<UILayoutStoreState> {
  const result: MutableUILayoutState = {};
  try {
    const previewVisibleRaw = localStorage.getItem(STORAGE_KEYS.previewVisible);
    if (previewVisibleRaw !== null) {
      const parsed = JSON.parse(previewVisibleRaw);
      if (typeof parsed === 'boolean') {
        result.previewVisible = parsed;
      }
    }
  } catch {
    // Ignore invalid data, use defaults
  }
  return result;
}

// Store is created with persisted state already merged
export const useUILayoutStore = create<UILayoutStore>()(
  immer((set, get) => ({
    ...initialState,
    // Actions...
  }))
);

// Hydrate synchronously on module load (not in useEffect)
useUILayoutStore.getState().loadFromStorage();
```

**Key insight**: The `loadFromStorage()` call happens at module import time, before any React component renders. This ensures no flash of default state.

### 2. Schema Validation with Zod

Continue using Zod for localStorage validation (per Constitution Section 3.3):

```typescript
// From contracts/command-schemas.ts
export const UILayoutPersistedSchema = z.object({
  previewVisible: z.boolean(),
  zoomLevel: z.number().min(50).max(200),
});

export function parseUILayout(value: unknown): UILayoutPersisted | null {
  const result = UILayoutPersistedSchema.safeParse(value);
  return result.success ? result.data : null;
}
```

### 3. Settings Categories

| Category | Storage | Store | Keys |
|----------|---------|-------|------|
| **UI Layout** | localStorage | `useUILayoutStore` | `previewVisible`, `sidebarVisible`, `zoomLevel`, `splitRatio` |
| **Recent Commands** | localStorage | `useCommandRegistry` | `recentCommands` |
| **Theme** | localStorage | `useSettingsStore` (new) | `theme` |
| **Recent Files** | electron-store | `RecentFilesService` | `recentFiles` |
| **Window Bounds** | electron-store | Main process | `windowBounds` |

### 4. Migration Strategy (if needed later)

If migrating from localStorage to electron-store in the future:

```typescript
// One-time migration on first load
function migrateFromLocalStorage(): void {
  const MIGRATION_KEY = 'mdxpad:settings:migrated-v2';
  if (localStorage.getItem(MIGRATION_KEY)) return;

  const oldSettings = {
    previewVisible: localStorage.getItem('mdxpad:ui:preview-visible'),
    zoomLevel: localStorage.getItem('mdxpad:ui:zoom-level'),
  };

  // Send to main process via IPC
  window.mdxpad.migrateSettings(oldSettings);

  localStorage.setItem(MIGRATION_KEY, 'true');
}
```

### 5. Debounce Strategy

Per NFR "Settings persistence must be debounced to avoid excessive disk writes":

```typescript
// Debounce settings save by 500ms
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedPersist(state: UILayoutStoreState): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    localStorage.setItem(STORAGE_KEYS.previewVisible, JSON.stringify(state.previewVisible));
    localStorage.setItem(STORAGE_KEYS.zoomLevel, JSON.stringify(state.zoomLevel));
  }, 500);
}
```

### 6. Split Ratio Persistence

Add `splitRatio` to the UI layout store:

```typescript
export interface UILayoutStoreState {
  readonly previewVisible: boolean;
  readonly sidebarVisible: boolean;
  readonly zoomLevel: number;
  readonly splitRatio: number; // 0-1, position of divider
}

// Validation: clamp to valid range on load
function clampSplitRatio(ratio: number): number {
  return Math.max(0.1, Math.min(0.9, ratio)); // Enforce min pane visibility
}
```

---

## Constitution Compliance

| Article | Requirement | Compliance |
|---------|-------------|------------|
| II | Zustand + Immer for state | PASS - stores use Zustand with Immer |
| II | zod for validation | PASS - schemas validate localStorage data |
| III.3 | IPC invoke/handle pattern | PASS - no sync IPC for settings |
| V | Cold start < 2s | PASS - sync localStorage doesn't add latency |
| VII.3 | Graceful degradation | PASS - invalid settings fall back to defaults |

---

## Summary

The hybrid approach leverages the strengths of each storage mechanism:

- **localStorage**: Fast, synchronous, perfect for renderer-only UI preferences
- **electron-store**: Robust, validated, necessary for main process data

This pattern is already established in the codebase and should be continued for new settings. The key implementation detail is synchronous initialization (load at module import time, not in useEffect) to prevent flash of default state.
