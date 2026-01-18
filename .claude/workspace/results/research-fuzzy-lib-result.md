# Fuzzy Matching Library Research for File Tree Filtering

## Decision

**Chosen Library: `fzf` (fzf-for-js)**

## Rationale

The `fzf` package (npm: `fzf`, GitHub: `ajitid/fzf-for-js`) is the optimal choice for the file tree filter feature because:

1. **True fzf-style sequential matching**: It is a direct port of the original fzf algorithm to JavaScript, providing authentic sequential character matching behavior that users familiar with fzf expect.

2. **Match positions for highlighting**: Returns a `positions` Set containing indices of matched characters, enabling precise highlighting. Example usage:
   ```typescript
   const entries = fzf.find('li');
   entry.positions // Set<number> of matched character indices
   ```

3. **Excellent TypeScript support**: Written in TypeScript (79.7% of codebase), ships with built-in type definitions (`./dist/main.d.ts`).

4. **Small bundle size**: ~5-7KB minified (based on benchmark comparisons and package structure).

5. **Zero dependencies**: No external runtime dependencies.

6. **Browser-compatible**: Specifically designed for browser context, no Node.js dependencies.

7. **Smart case sensitivity**: Implements fzf's smart-case search (lowercase = case-insensitive, uppercase = case-sensitive).

8. **Performance**: Designed for interactive use in command palettes and similar UI patterns. Suitable for 10,000+ items.

9. **Active maintenance**: Last release v0.5.2 (April 2023), 947 GitHub stars, used by 5.2k projects.

## Library Evaluation Matrix

| Criteria | fzf | Fuse.js | uFuzzy | FlexSearch | Custom |
|----------|-----|---------|--------|------------|--------|
| Sequential matching (fzf-style) | Yes | No | Yes | No | Depends |
| Match indices for highlighting | Yes (`positions` Set) | Yes (`includeMatches`) | Yes (`info.ranges`) | No | Depends |
| Bundle size (minified) | ~5-7KB | ~24KB | ~7.6KB | ~6-41KB | Minimal |
| TypeScript support | Native | Native | Native | Partial | Depends |
| Browser-compatible | Yes | Yes | Yes | Yes | Yes |
| Performance (10k items) | Excellent | Slow (~35ms/100k) | Excellent | Excellent (indexing) | Depends |
| Active maintenance | Yes | Yes | Yes | Yes | N/A |

## Detailed Library Analysis

### 1. fzf (fzf-for-js) - RECOMMENDED

**NPM**: `fzf` | **Version**: 0.5.2 | **Stars**: 947

**Pros**:
- Direct port of fzf algorithm - authentic behavior
- Returns `positions` Set for highlighting matched characters
- Native TypeScript with excellent type definitions
- Smart-case search built-in
- Zero dependencies
- Small bundle (~5-7KB minified)
- Designed for browser/command palette use cases
- Selector function support for searching object properties

**Cons**:
- Smaller community than Fuse.js
- Less configurable than some alternatives

**API Example**:
```typescript
import { Fzf, FzfResultItem } from 'fzf';

const fzf = new Fzf(fileList, {
  selector: (item) => item.path,
  casing: 'smart-case'
});

const results = fzf.find(query);
// results[0].positions -> Set<number> of matched indices
// results[0].score -> higher = better match
// results[0].start, results[0].end -> match bounds
```

---

### 2. Fuse.js

**NPM**: `fuse.js` | **Version**: 7.1.0 | **Stars**: 16.6k

**Pros**:
- Most popular fuzzy search library (16.6k stars)
- Extensive documentation
- `includeMatches` option returns indices for highlighting
- Highly configurable (threshold, distance, location, etc.)
- Native TypeScript support

**Cons**:
- **Not sequential matching**: Uses approximate string matching algorithm, not fzf-style
- Larger bundle size (~24KB minified)
- Slower performance (~35ms for 100k records in benchmarks)
- Match indices can be inconsistent (reported issues with highlighting accuracy)
- Default configuration only searches first 60 characters

**Why Not Chosen**: Does not implement fzf-style sequential character matching. The matching algorithm is fundamentally different - it uses fuzzy/approximate matching rather than sequential character matching.

---

### 3. uFuzzy (@leeoniya/ufuzzy)

**NPM**: `@leeoniya/ufuzzy` | **Version**: 1.0.19 | **Stars**: 2.3k

**Pros**:
- Excellent performance (434ms for 86 searches on large corpus)
- Small bundle (~7.6KB minified)
- Returns `info.ranges` for highlighting
- Supports out-of-order term matching
- Supports exclusions (e.g., `fruit -green -melon`)
- Native TypeScript support
- Very memory efficient

**Cons**:
- More complex 3-phase API (filter -> info -> sort)
- Not a direct fzf port (different algorithm)
- Designed for larger text corpuses rather than file paths

**Why Not Chosen**: While excellent for general fuzzy search, it's not a true fzf implementation. The API is more complex with its 3-phase approach. Better suited for full-text search of longer content rather than file path filtering.

**API Example**:
```typescript
import uFuzzy from '@leeoniya/ufuzzy';

const uf = new uFuzzy();
const idxs = uf.filter(haystack, needle);
const info = uf.info(idxs, haystack, needle);
const order = uf.sort(info, haystack, needle);
// info.ranges contains highlight positions
```

---

### 4. FlexSearch

**NPM**: `flexsearch` | **Version**: 0.8.212 | **Stars**: 10.7k

**Pros**:
- Fastest full-text search library
- Multiple index types (Index, Document, Worker)
- Web Worker support for parallel processing
- Contextual search algorithm
- Phonetic matching support

**Cons**:
- **No match indices for highlighting**: Does not return match positions
- **Not sequential matching**: Full-text search, not fzf-style
- Requires index building (3210ms init time in benchmarks)
- Higher memory usage due to indexing
- Larger bundle for full features

**Why Not Chosen**: FlexSearch is designed for full-text search with indexing, not fzf-style sequential matching. Critically, it does not return match positions needed for highlighting.

---

### 5. Custom Implementation

**Pros**:
- Minimal bundle size
- Full control over algorithm
- No dependencies

**Cons**:
- Development time
- Testing burden
- Risk of edge cases
- Maintenance overhead

**Why Not Chosen**: The `fzf` package already implements the exact algorithm needed with proper TypeScript support and is battle-tested. Building a custom implementation would be reinventing the wheel without clear benefits.

**Reference Algorithm** (if custom were needed):
```typescript
function fuzzyMatch(needle: string, haystack: string): { score: number; positions: number[] } | null {
  const needleLower = needle.toLowerCase();
  const haystackLower = haystack.toLowerCase();

  let needleIdx = 0;
  const positions: number[] = [];

  for (let i = 0; i < haystack.length && needleIdx < needle.length; i++) {
    if (haystackLower[i] === needleLower[needleIdx]) {
      positions.push(i);
      needleIdx++;
    }
  }

  if (needleIdx !== needle.length) return null;

  // Scoring: prefer consecutive matches, early matches
  const score = calculateScore(positions, haystack.length);
  return { score, positions };
}
```

---

## Performance Considerations

Based on uFuzzy's benchmark data (most comprehensive available):

| Library | Init Time | Search Time (86 queries) | Memory (Peak) |
|---------|-----------|-------------------------|---------------|
| uFuzzy | 0.5ms | 434ms | 28.4MB |
| fzf-for-js | ~0.1ms | ~500-800ms* | ~30MB* |
| Fuse.js | 31ms | 33,875ms | 245MB |
| FlexSearch | 3,210ms | 83ms | 670MB |

*Estimated based on similar algorithm characteristics

For 10,000 files:
- **fzf**: Expected <100ms easily achievable
- **Fuse.js**: May exceed 100ms requirement
- **uFuzzy**: Will meet requirement
- **FlexSearch**: Init time problematic, but queries fast

---

## Recommendation Summary

**Use `fzf` (fzf-for-js)** for the file tree filter feature because:

1. It implements the exact fzf-style sequential matching algorithm requested
2. Provides `positions` Set for accurate match highlighting
3. Has excellent TypeScript support with native types
4. Small bundle size (~5-7KB) suitable for Electron renderer
5. Zero dependencies - no Node.js requirements
6. Designed specifically for command palette / fuzzy finder UI patterns
7. Performance suitable for 10,000+ files
8. Active maintenance and reasonable community adoption

## Installation

```bash
npm install fzf
```

## Basic Implementation Pattern

```typescript
import { Fzf, FzfResultItem } from 'fzf';

interface FileEntry {
  path: string;
  name: string;
}

// Initialize once with file list
const fzf = new Fzf<FileEntry>(files, {
  selector: (item) => item.path,
  casing: 'smart-case',
  tiebreakers: [
    (a, b, selector) => selector(a.item).length - selector(b.item).length
  ]
});

// Filter on user input
function filterFiles(query: string): Array<{ item: FileEntry; positions: Set<number> }> {
  if (!query) return files.map(item => ({ item, positions: new Set() }));

  return fzf.find(query).map(result => ({
    item: result.item,
    positions: result.positions
  }));
}

// Highlight component helper
function highlightMatch(text: string, positions: Set<number>): string {
  return text.split('').map((char, i) =>
    positions.has(i) ? `<mark>${char}</mark>` : char
  ).join('');
}
```

---

## Alternatives Considered

| Library | Reason Rejected |
|---------|-----------------|
| Fuse.js | Not sequential matching; slower performance; larger bundle |
| uFuzzy | More complex API; not true fzf algorithm; designed for longer text |
| FlexSearch | No match indices; requires indexing; not sequential matching |
| Custom | Unnecessary given fzf package availability; maintenance burden |

---

*Research conducted: 2026-01-17*
*Context: mdxpad file tree filter feature (Spec 014)*
