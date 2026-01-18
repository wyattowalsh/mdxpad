# Research: localStorage Persistence for Filter State

## Context
- **Feature**: Smart Filtering for File Tree (Spec 014)
- **Requirement**: Persist filter query per project/workspace across sessions (FR-007)
- **Scope**: Project-scoped storage key, error handling, schema migration

---

## Decision: Recommended Approach

### 1. Key Naming Convention

**Decision**: Use hierarchical namespace with project path hash

```typescript
// Pattern: mdxpad:<domain>:<feature>:<scope-hash>
const FILTER_STORAGE_KEY_PREFIX = 'mdxpad:filter:query:';

// Full key example:
// mdxpad:filter:query:a1b2c3d4  (where hash = MD5/SHA256 of project path)
```

**Rationale**:
- Aligns with existing codebase patterns (`mdxpad:ui:preview-visible`, `mdxpad:ui:split-ratio`)
- Hierarchical structure allows easy identification and cleanup
- Hash-based scoping avoids issues with special characters in paths
- Short hash (8 chars) balances uniqueness vs storage overhead

**Implementation**:
```typescript
import { createHash } from 'crypto';

function getFilterStorageKey(projectPath: string): string {
  const hash = createHash('sha256')
    .update(projectPath)
    .digest('hex')
    .slice(0, 8);
  return `${FILTER_STORAGE_KEY_PREFIX}${hash}`;
}
```

### 2. Serialization Format

**Decision**: Plain string (not JSON)

**Rationale**:
- Filter query is a simple string value
- No need for JSON overhead (`JSON.stringify`/`JSON.parse`)
- Reduces complexity and potential parsing errors
- Consistent with the atomic nature of the data

**Implementation**:
```typescript
// Save
localStorage.setItem(key, filterQuery);

// Load
const filterQuery = localStorage.getItem(key) ?? '';
```

### 3. Error Handling Patterns

**Decision**: Defensive try-catch with graceful fallback

**Rationale**:
- localStorage can fail silently in private browsing modes
- QuotaExceededError varies across browsers (code 22, 1014, etc.)
- Filter state is non-critical; app should function without it

**Implementation**:
```typescript
/**
 * Safe localStorage wrapper for filter persistence.
 * Returns empty string on any failure - filter state is non-critical.
 */
export function loadFilterQuery(projectPath: string): string {
  try {
    const key = getFilterStorageKey(projectPath);
    return localStorage.getItem(key) ?? '';
  } catch {
    // Storage unavailable (private mode, disabled, etc.)
    return '';
  }
}

export function saveFilterQuery(projectPath: string, query: string): void {
  try {
    const key = getFilterStorageKey(projectPath);
    if (query === '') {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, query);
    }
  } catch (err) {
    // Log for debugging but don't disrupt user experience
    console.warn('Filter persistence failed:', err);
  }
}

/**
 * Check if error is a QuotaExceededError (cross-browser).
 */
function isQuotaExceededError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.code === 22 ||        // Most browsers
     err.code === 1014 ||      // Firefox
     err.name === 'QuotaExceededError' ||
     err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}
```

### 4. Migration Strategy

**Decision**: No versioning needed initially; use atomic key-per-value pattern

**Rationale**:
- Filter query is a single string value, not a complex schema
- No nested objects or arrays to migrate
- If schema changes, old keys simply become orphaned (no corruption risk)
- Can add cleanup utility later if needed

**Future-proofing** (if schema becomes complex):
```typescript
// If we ever need versioned storage:
const FILTER_STORAGE_VERSION = 1;
const FILTER_STORAGE_KEY_PREFIX = `mdxpad:filter:v${FILTER_STORAGE_VERSION}:query:`;

// Migration would involve:
// 1. Check for old keys (v0 or unversioned)
// 2. Read and transform data
// 3. Write to new versioned key
// 4. Delete old key
```

### 5. Performance Considerations

**Decision**: Debounced persistence (reuse existing 50ms pattern)

**Rationale**:
- User types filter query character-by-character
- FR-010 already specifies 50ms debounce for filtering
- Persistence should piggyback on this debounce, not add another
- localStorage is synchronous and can block main thread

**Implementation**:
```typescript
// In filter store (Zustand with Immer pattern)
let persistDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedPersistFilter(projectPath: string, query: string): void {
  if (persistDebounceTimer !== null) {
    clearTimeout(persistDebounceTimer);
  }
  persistDebounceTimer = setTimeout(() => {
    saveFilterQuery(projectPath, query);
    persistDebounceTimer = null;
  }, 50);
}
```

---

## Alternatives Considered

### Key Naming

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Full path as key | Simple, readable | Special chars, very long keys | Rejected |
| Hash of path | Short, safe chars | Not human-readable | **Selected** |
| Sequential ID | Short | Requires ID mapping table | Rejected |
| Base64 path | Reversible | Still long, padding chars | Rejected |

### Serialization

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Plain string | Simple, fast, no parsing | Can't extend to object | **Selected** |
| JSON string | Extensible | Overhead, parse errors | Alternative |
| JSON with version | Future-proof | Over-engineered for string | Rejected |

### Storage Location

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| localStorage | Simple, sync, proven pattern | 5MB limit, sync blocking | **Selected** |
| electron-store | Main process, more robust | IPC overhead, complexity | Alternative |
| IndexedDB | Large storage, async | Overkill for single string | Rejected |
| File system | Unlimited | Electron-specific, complex | Rejected |

### Error Handling

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Silent fail + fallback | Non-disruptive UX | No visibility into issues | **Selected** |
| User notification | User awareness | Annoying for non-critical | Rejected |
| Retry with cleanup | Self-healing | Complex, may delete user data | Rejected |

---

## Integration with Existing Codebase

### Consistency with Current Patterns

The codebase already uses these patterns (from `ui-layout-store.ts`):

1. **Storage key constants** in dedicated schemas file
2. **Individual keys per value** (not one big JSON blob)
3. **Separate try-catch per field** during load
4. **Debounced persistence** for frequent updates
5. **Graceful fallback to defaults** on any error

### Proposed Addition to Storage Keys

```typescript
// In .specify/specs/014-smart-filtering/contracts/filter-schemas.ts

/**
 * localStorage key prefix for filter persistence.
 * Full key: mdxpad:filter:query:<project-hash>
 */
export const FILTER_STORAGE_KEY_PREFIX = 'mdxpad:filter:query:' as const;

/**
 * Generate project-scoped storage key for filter query.
 */
export function getFilterStorageKey(projectPath: string): string {
  // Use simple hash to avoid path special chars in key
  const hash = simpleHash(projectPath);
  return `${FILTER_STORAGE_KEY_PREFIX}${hash}`;
}

/**
 * Simple string hash (FNV-1a) for project path scoping.
 * Returns 8-char hex string.
 */
function simpleHash(str: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, unsigned
  }
  return hash.toString(16).padStart(8, '0');
}
```

---

## Handling Edge Cases

### Storage Quota Exceeded
- Log warning, continue without persistence
- Filter still works in-memory during session

### Corrupted/Invalid Data
- Return empty string (valid default state)
- No need to clear - just ignore

### Missing Project Path
- Global fallback key: `mdxpad:filter:query:global`
- Or skip persistence entirely for unsaved documents

### Cross-Session State Conflicts
- Last-write-wins (simple, predictable)
- No merge logic needed for single string value

---

## Summary

| Aspect | Decision |
|--------|----------|
| Key format | `mdxpad:filter:query:<8-char-hash>` |
| Serialization | Plain string (no JSON) |
| Error handling | Silent fail with empty fallback |
| Migration | None needed; atomic key-per-value |
| Performance | 50ms debounced write |
| Storage | localStorage (existing pattern) |

This approach maintains consistency with the existing codebase patterns while providing robust, project-scoped persistence for filter queries.
