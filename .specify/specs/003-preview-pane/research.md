# Research: Preview Pane

**Feature**: 003-preview-pane
**Date**: 2026-01-09
**Status**: Complete

## Research Questions

1. How does @mdx-js/mdx 3.x compile MDX to executable JavaScript?
2. What is the optimal Web Worker pattern for MDX compilation?
3. How to safely render compiled MDX in a sandboxed iframe?
4. What built-in components are expected in MDX editors?
5. How to implement scroll synchronization between editor and preview?

---

## Q1: MDX Compilation Pipeline

### @mdx-js/mdx 3.x Architecture

The MDX compiler transforms MDX source into JavaScript that exports a React component:

```typescript
import { compile } from '@mdx-js/mdx';

const result = await compile(mdxSource, {
  outputFormat: 'function-body',  // For runtime evaluation
  development: false,
  remarkPlugins: [remarkGfm, remarkFrontmatter],
  rehypePlugins: [rehypeHighlight],
});

// Result: JavaScript string that can be eval'd with React runtime
```

### Key Compilation Options

| Option | Value | Rationale |
|--------|-------|-----------|
| `outputFormat` | `'function-body'` | Returns function body for `new Function()` instantiation |
| `development` | `false` | Production mode, smaller output |
| `jsxRuntime` | `'automatic'` | Use React 17+ JSX transform |
| `jsxImportSource` | `'react'` | Standard React JSX |

### Frontmatter Extraction

Use `remark-frontmatter` for parsing + `vfile-matter` for extraction:

```typescript
import { compile } from '@mdx-js/mdx';
import remarkFrontmatter from 'remark-frontmatter';
import { matter } from 'vfile-matter';

const file = await compile(mdxSource, {
  remarkPlugins: [
    remarkFrontmatter,
    () => (tree, file) => { matter(file); }
  ],
});

const frontmatter = file.data.matter; // Parsed YAML as object
```

### Error Handling

MDX compilation errors include position information:

```typescript
try {
  await compile(source);
} catch (error) {
  if (error instanceof VFileMessage) {
    // error.line, error.column, error.reason available
  }
}
```

**Recommendation**: Wrap compilation in try-catch, extract VFileMessage properties for CompileError.

---

## Q2: Web Worker Pattern for MDX

### Worker Architecture

The MDX compiler is CPU-intensive. Running in a Web Worker prevents UI blocking:

```typescript
// mdx-compiler.worker.ts
import { compile } from '@mdx-js/mdx';

self.onmessage = async (event: MessageEvent<CompileRequest>) => {
  const { id, source } = event.data;
  try {
    const result = await compile(source, options);
    self.postMessage({ id, ok: true, code: String(result), frontmatter });
  } catch (error) {
    self.postMessage({ id, ok: false, errors: extractErrors(error) });
  }
};
```

### Bundling Considerations

Web Workers in Vite/electron-vite:

1. **Inline Worker**: `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`
2. **Bundle Dependencies**: Worker must include @mdx-js/mdx and plugins
3. **Separate Entry**: Configure vite to bundle worker as separate chunk

### Message Protocol

```typescript
// Request (main → worker)
interface CompileRequest {
  id: string;         // Correlation ID for debouncing
  source: string;     // MDX source text
}

// Response (worker → main)
type CompileResponse =
  | { id: string; ok: true; code: string; frontmatter: Record<string, unknown> }
  | { id: string; ok: false; errors: CompileError[] };
```

### Debouncing Strategy

Debounce at the caller level, not in the worker:

```typescript
// usePreview.ts
const debouncedCompile = useMemo(
  () => debounce((source: string) => {
    const id = crypto.randomUUID();
    currentRequestId.current = id;
    worker.postMessage({ id, source });
  }, 300),
  [worker]
);
```

**Recommendation**: Use 300ms debounce (per FR-004). Cancel stale responses by checking request ID.

---

## Q3: Sandboxed Iframe Rendering

### Iframe Sandbox Configuration

Per FR-002 and security research:

```html
<iframe
  sandbox="allow-scripts"
  src="preview-frame.html"
  title="MDX Preview"
></iframe>
```

**Critical**: Do NOT include:
- `allow-same-origin` — Prevents iframe from accessing parent localStorage, cookies
- `allow-top-navigation` — Prevents iframe from redirecting parent
- `allow-forms` — Prevents form submissions
- `allow-popups` — Prevents opening new windows

### Content Security Policy

Apply CSP via meta tag in iframe HTML (per FR-017):

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data: https:; connect-src 'none';">
```

### PostMessage Communication

Unidirectional pattern (per FR-018):

```typescript
// Parent → Iframe (render command)
interface RenderCommand {
  type: 'render';
  code: string;          // Compiled MDX JavaScript
  frontmatter: Record<string, unknown>;
  theme: 'light' | 'dark';
}

// Iframe → Parent (status signals only)
interface ReadySignal { type: 'ready'; }
interface SizeSignal { type: 'size'; height: number; }
interface ErrorSignal { type: 'error'; message: string; }
```

### Runtime Evaluation

In the iframe, use `new Function()` to instantiate compiled MDX:

```typescript
// preview-frame/renderer.tsx
function renderMDX(code: string, components: Record<string, React.ComponentType>) {
  const scope = { React, jsx, jsxs, Fragment, ...components };
  const fn = new Function(...Object.keys(scope), code);
  const { default: MDXContent } = fn(...Object.values(scope));
  return <MDXContent components={components} />;
}
```

**Recommendation**: Wrap rendering in React ErrorBoundary for runtime error catching (FR-022).

---

## Q4: Built-in MDX Components

### Expected Component Set

Based on FR-009 through FR-014 and industry standards:

| Component | Purpose | Variants/Props |
|-----------|---------|----------------|
| Typography | h1-h6, p, a, ul, ol, li, blockquote, hr, table | N/A (HTML mappings) |
| `CodeBlock` | Syntax-highlighted code | `language`, `title`, `showLineNumbers`, copy button |
| `Callout` | Highlighted info boxes | `type`: info, warning, error, success, note, tip |
| `Tabs`/`Tab` | Tabbed content sections | `label`, `value`, controlled state |
| `Card`/`CardGrid` | Linked cards in grid | `title`, `href`, `icon` |
| `FileTree` | Directory visualization | `data` as tree structure |

### Implementation Approach

1. **Typography**: Map HTML elements to styled components via MDX provider
2. **Interactive Components**: Use React state for Tabs, copy button
3. **Styling**: CSS variables for theme support (FR-021)

### CodeBlock with Syntax Highlighting

Use `rehype-highlight` during compilation (server-side highlighting):

```typescript
// Compilation config
rehypePlugins: [
  [rehypeHighlight, { detect: true, ignoreMissing: true }]
]
```

Copy button implemented in CodeBlock component:

```typescript
const CodeBlock = ({ children, className }) => {
  const copyToClipboard = () => navigator.clipboard.writeText(children);
  return (
    <div className="code-block">
      <pre><code className={className}>{children}</code></pre>
      <button onClick={copyToClipboard}>Copy</button>
    </div>
  );
};
```

**Recommendation**: Apply highlight.js theme CSS in preview iframe, sync with app theme.

---

## Q5: Scroll Synchronization

### Approach: Proportional Scroll Position

Simple proportional mapping (per FR-020):

```typescript
// Editor scroll handler
const handleEditorScroll = (scrollTop: number, scrollHeight: number) => {
  const scrollRatio = scrollTop / (scrollHeight - viewportHeight);
  iframe.contentWindow.postMessage({
    type: 'scroll',
    ratio: scrollRatio
  }, '*');
};

// Iframe scroll receiver
window.addEventListener('message', (event) => {
  if (event.data.type === 'scroll') {
    const targetScroll = event.data.ratio * (document.body.scrollHeight - window.innerHeight);
    window.scrollTo({ top: targetScroll, behavior: 'smooth' });
  }
});
```

### Limitations

- Proportional scroll is approximate—MDX output length differs from source length
- Source maps would enable precise sync but add complexity
- "Smooth" behavior per FR-020 Acceptance Scenario 2

**Recommendation**: Start with proportional scroll. Source-map-based sync deferred to future enhancement.

---

## Q6: Theme Synchronization

### CSS Variables Approach

Define theme tokens as CSS variables (per FR-021):

```css
:root {
  --preview-bg: #ffffff;
  --preview-text: #1a1a1a;
  --preview-code-bg: #f5f5f5;
}

[data-theme="dark"] {
  --preview-bg: #1a1a1a;
  --preview-text: #e5e5e5;
  --preview-code-bg: #2d2d2d;
}
```

### Theme Propagation

Send theme via postMessage when app theme changes:

```typescript
// Parent: on theme change
iframe.contentWindow.postMessage({ type: 'theme', value: 'dark' }, '*');

// Iframe: apply theme
window.addEventListener('message', (event) => {
  if (event.data.type === 'theme') {
    document.documentElement.setAttribute('data-theme', event.data.value);
  }
});
```

**Recommendation**: Theme change should NOT require re-compilation (per SC-007: <100ms).

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Compilation location | Web Worker | Constitution III.5; prevents UI blocking |
| Output format | `function-body` | Enables `new Function()` evaluation in iframe |
| Iframe sandbox | `allow-scripts` only | C1-H hardened sandbox from clarification |
| Communication | Unidirectional postMessage | FR-018; security isolation |
| Scroll sync | Proportional ratio | Simple, performant; precise sync deferred |
| Theme | CSS variables + postMessage | No re-compile needed |
| Error handling | Replace preview entirely | Clarification Q1; cache last good render |

---

## Dependencies to Add

```json
{
  "dependencies": {
    "@mdx-js/mdx": "^3.1.1",
    "@mdx-js/react": "^3.1.1",
    "remark-gfm": "^4.0.1",
    "remark-frontmatter": "^5.0.0",
    "rehype-highlight": "^7.0.2",
    "vfile-matter": "^5.0.0"
  }
}
```

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| MDX compile exceeds 500ms budget | Medium | High | Profile typical docs; warn for large docs (FR-023) |
| Worker bundle size too large | Low | Medium | Tree-shake MDX; lazy load plugins |
| Iframe CSP blocks needed features | Low | High | Test CSP thoroughly; adjust if needed |
| Custom components break sandbox | Medium | High | ErrorBoundary catches runtime errors (FR-022) |

---

## Next Steps

1. **Phase 1**: Define data models, contracts, and quickstart
2. Create `data-model.md` with state types and message schemas
3. Create `contracts/` with TypeScript interfaces
4. Create `quickstart.md` with integration guide
