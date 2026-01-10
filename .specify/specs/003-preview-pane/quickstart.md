# Quickstart: Preview Pane

**Feature**: 003-preview-pane
**Date**: 2026-01-09

## Overview

This guide explains how to integrate the Preview Pane feature into mdxpad. The Preview Pane provides live MDX rendering with real-time updates as the user types.

---

## Architecture Summary

```
┌────────────────────────────────────────────────────────────────┐
│                     RENDERER PROCESS                            │
│                                                                  │
│  ┌──────────────┐      ┌─────────────┐      ┌───────────────┐  │
│  │   Editor     │──────▶│ usePreview │──────▶│  Web Worker   │  │
│  │ (CodeMirror) │      │   (hook)    │◀─────│ (MDX Compile) │  │
│  └──────────────┘      └─────────────┘      └───────────────┘  │
│         │                     │                                 │
│         │              PreviewState                             │
│         │                     ▼                                 │
│         │              ┌─────────────┐                          │
│         │              │ PreviewPane │                          │
│         │              │  (React)    │                          │
│         │              └─────────────┘                          │
│         │                     │                                 │
│  scrollRatio           postMessage                              │
│         │                     ▼                                 │
└─────────┼─────────────────────┼────────────────────────────────┘
          │                     │
          │      ┌──────────────┴──────────────┐
          └─────▶│     SANDBOXED IFRAME        │
                 │   (Preview Frame)           │
                 │   sandbox="allow-scripts"   │
                 └─────────────────────────────┘
```

---

## Quick Integration

### 1. Import the Preview Hook

```typescript
import { usePreview } from '@/renderer/hooks/usePreview';
```

### 2. Use in Your Editor Component

```tsx
function EditorWithPreview() {
  const [source, setSource] = useState('# Hello World');
  const { state, scrollRatio, setScrollRatio } = usePreview(source);

  return (
    <div className="editor-layout">
      <Editor
        value={source}
        onChange={setSource}
        onScroll={(ratio) => setScrollRatio(ratio)}
      />
      <PreviewPane
        source={source}
        scrollRatio={scrollRatio}
        onStateChange={(newState) => console.log('Preview:', newState.status)}
      />
    </div>
  );
}
```

---

## Component Reference

### PreviewPane

Main preview component that renders MDX in a sandboxed iframe.

```tsx
<PreviewPane
  source={mdxSource}           // MDX source text
  scrollRatio={0.5}            // Editor scroll position (0-1)
  onStateChange={handleState}  // State change callback
  className="preview-pane"     // CSS class
/>
```

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | Yes | MDX source text to compile and render |
| `scrollRatio` | `number` | No | Editor scroll position (0-1) for sync |
| `onStateChange` | `(state: PreviewState) => void` | No | Called when preview state changes |
| `className` | `string` | No | CSS class for styling |

### ErrorDisplay

Displays compilation errors with line numbers.

```tsx
<ErrorDisplay
  errors={state.errors}
  onErrorClick={(line, col) => editor.goToLine(line, col)}
/>
```

---

## Preview State

The preview can be in one of four states:

```typescript
type PreviewState =
  | { status: 'idle' }
  | { status: 'compiling' }
  | { status: 'success'; result: CompileSuccess }
  | { status: 'error'; errors: CompileError[] };
```

### State Transitions

1. **idle** → User hasn't typed anything yet
2. **compiling** → MDX is being compiled in Web Worker
3. **success** → Compilation succeeded, preview is rendered
4. **error** → Compilation failed, errors are displayed

### Handling State Changes

```tsx
function handleStateChange(state: PreviewState) {
  switch (state.status) {
    case 'idle':
      // Show placeholder
      break;
    case 'compiling':
      // Show loading indicator
      break;
    case 'success':
      // Preview is rendered, access frontmatter if needed
      console.log(state.result.frontmatter);
      break;
    case 'error':
      // Errors replace preview content
      // Last successful render is cached internally
      break;
  }
}
```

---

## Built-in MDX Components

These components are available in all MDX documents:

### Callout

```mdx
<Callout type="warning" title="Important">
  This is a warning message.
</Callout>
```

Types: `info`, `warning`, `error`, `success`, `note`, `tip`

### CodeBlock

Automatically applied to fenced code blocks:

````mdx
```typescript title="example.ts" showLineNumbers
const x = 42;
```
````

### Tabs

```mdx
<Tabs defaultValue="npm">
  <Tab value="npm" label="npm">
    npm install mdxpad
  </Tab>
  <Tab value="pnpm" label="pnpm">
    pnpm add mdxpad
  </Tab>
</Tabs>
```

### Card / CardGrid

```mdx
<CardGrid columns={2}>
  <Card title="Getting Started" href="/docs/start" icon={<BookIcon />}>
    Learn the basics
  </Card>
  <Card title="API Reference" href="/docs/api">
    Detailed API docs
  </Card>
</CardGrid>
```

### FileTree

```mdx
<FileTree data={[
  { name: 'src', type: 'directory', children: [
    { name: 'index.ts', type: 'file' },
    { name: 'utils.ts', type: 'file' },
  ]},
  { name: 'package.json', type: 'file' },
]} />
```

---

## Theme Support

The preview automatically syncs with the application theme:

```tsx
// App-level theme management
function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mediaQuery.matches ? 'dark' : 'light');
  }, []);

  return (
    <ThemeProvider value={theme}>
      <PreviewPane source={source} />
    </ThemeProvider>
  );
}
```

The preview iframe receives theme updates via postMessage and applies CSS variable changes without re-compilation.

---

## Performance Considerations

### Debouncing

Compilation is debounced by default (300ms). Adjust via config:

```tsx
const { state } = usePreview(source, {
  debounceMs: 500, // Custom debounce
});
```

### Large Documents

For documents exceeding ~50,000 characters, a non-blocking performance warning is displayed. The preview still renders but may take longer.

### Web Worker

MDX compilation runs in a Web Worker, ensuring the UI remains responsive even for complex documents.

---

## Security Model

The preview iframe uses a hardened sandbox:

```html
<iframe sandbox="allow-scripts" />
```

**Restrictions:**
- No `allow-same-origin` — Cannot access parent localStorage/cookies
- No `allow-top-navigation` — Cannot redirect parent window
- No network access — CSP blocks `connect-src`

**User Warning:**

The preview displays: "Preview executes code from your MDX"

This is appropriate because mdxpad is a local-first editor where users execute their own code.

---

## Error Handling

### Compilation Errors

Displayed in ErrorDisplay component with:
- Error message
- Line number (clickable to navigate)
- Column number (if available)

### Runtime Errors

Component errors during rendering are caught by React ErrorBoundary:
- Error message displayed in preview
- Stack trace logged to console
- Last successful render cached for recovery

---

## Testing

### Unit Tests

```typescript
import { renderHook, act } from '@testing-library/react';
import { usePreview } from './usePreview';

test('compiles MDX source', async () => {
  const { result } = renderHook(() => usePreview('# Hello'));

  await waitFor(() => {
    expect(result.current.state.status).toBe('success');
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test('preview updates on editor change', async ({ page }) => {
  await page.goto('/');
  await page.fill('.editor', '# New Heading');
  await expect(page.locator('.preview h1')).toHaveText('New Heading');
});
```

---

## Integration Scenarios

This section provides complete, copy-paste-ready integration patterns for common use cases.

### Scenario 1: Basic Usage with Source and Theme

The simplest integration passes MDX source and theme to PreviewPane.

```tsx
import { useState, useEffect } from 'react';
import { PreviewPane } from '@renderer/components/preview/PreviewPane';

function BasicPreview() {
  const [source, setSource] = useState('# Hello World\n\nThis is **MDX** content.');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Sync with system theme
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mediaQuery.matches ? 'dark' : 'light');

    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return (
    <div className="editor-container">
      <textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        className="source-editor"
      />
      <PreviewPane
        source={source}
        theme={theme}
        className="preview-container"
      />
    </div>
  );
}
```

**Key points:**
- `source` is the raw MDX string to compile
- `theme` controls CSS variables in the preview iframe
- Theme changes are instant (no recompilation needed)

### Scenario 2: Error Handling with Editor Navigation

Connect `onErrorClick` to navigate the editor cursor to error locations.

```tsx
import { useRef, useCallback, useState } from 'react';
import { PreviewPane } from '@renderer/components/preview/PreviewPane';
import type { EditorView } from '@codemirror/view';

function EditorWithErrorNavigation() {
  const [source, setSource] = useState('');
  const editorRef = useRef<EditorView | null>(null);

  // Handle error clicks by navigating editor to error location
  const handleErrorClick = useCallback((line: number, column?: number) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Calculate position from line/column
    const doc = editor.state.doc;
    const lineInfo = doc.line(Math.min(line, doc.lines));
    const pos = lineInfo.from + (column ? Math.min(column - 1, lineInfo.length) : 0);

    // Move cursor and scroll into view
    editor.dispatch({
      selection: { anchor: pos },
      scrollIntoView: true,
    });
    editor.focus();
  }, []);

  return (
    <div className="split-pane">
      <CodeMirrorEditor
        value={source}
        onChange={setSource}
        ref={editorRef}
      />
      <PreviewPane
        source={source}
        onErrorClick={handleErrorClick}
      />
    </div>
  );
}
```

**Error flow:**
1. User writes invalid MDX (e.g., unclosed JSX tag)
2. `ErrorDisplay` shows error with clickable "Line X, Column Y"
3. User clicks error location
4. `onErrorClick(line, column)` fires
5. Editor cursor jumps to error position

### Scenario 3: Scroll Synchronization

Wire scroll ratio between editor and preview for synchronized scrolling.

```tsx
import { useState, useCallback, useRef } from 'react';
import { PreviewPane } from '@renderer/components/preview/PreviewPane';
import type { EditorView } from '@codemirror/view';

function SynchronizedEditorPreview() {
  const [source, setSource] = useState('');
  const [scrollRatio, setScrollRatio] = useState(0);
  const editorRef = useRef<EditorView | null>(null);

  // Calculate scroll ratio from editor scroll position
  const handleEditorScroll = useCallback((view: EditorView) => {
    const scrollDOM = view.scrollDOM;
    const scrollTop = scrollDOM.scrollTop;
    const scrollHeight = scrollDOM.scrollHeight - scrollDOM.clientHeight;

    // Avoid division by zero
    if (scrollHeight <= 0) {
      setScrollRatio(0);
      return;
    }

    const ratio = Math.max(0, Math.min(1, scrollTop / scrollHeight));
    setScrollRatio(ratio);
  }, []);

  return (
    <div className="sync-scroll-container">
      <CodeMirrorEditor
        value={source}
        onChange={setSource}
        onScroll={handleEditorScroll}
        ref={editorRef}
      />
      <PreviewPane
        source={source}
        scrollRatio={scrollRatio}
      />
    </div>
  );
}
```

**Scroll sync flow (Editor -> Preview):**
1. User scrolls in editor
2. Editor calculates `scrollRatio` (0 = top, 1 = bottom)
3. `scrollRatio` prop updates on `PreviewPane`
4. `PreviewFrame` sends `ScrollCommand` via postMessage
5. Iframe scrolls to corresponding position

**Note:** Preview-to-editor sync uses `usePreview().setScrollRatio` but is not yet wired.

### Scenario 4: Handling Large Documents (>50k characters)

Large documents trigger a performance warning. Handle gracefully with user feedback.

```tsx
import { useState, useCallback, useMemo } from 'react';
import { PreviewPane } from '@renderer/components/preview/PreviewPane';
import { usePreview } from '@renderer/hooks/usePreview';

const LARGE_DOC_THRESHOLD = 50_000;

function LargeDocumentEditor() {
  const [source, setSource] = useState('');
  const { state, lastSuccessfulRender } = usePreview(source, {
    debounceMs: 500, // Longer debounce for large docs
  });

  const isLargeDocument = useMemo(
    () => source.length > LARGE_DOC_THRESHOLD,
    [source.length]
  );

  // Provide user feedback during compilation
  const statusMessage = useMemo(() => {
    if (state.status === 'compiling' && isLargeDocument) {
      return `Compiling large document (${Math.round(source.length / 1000)}k chars)...`;
    }
    if (state.status === 'compiling') {
      return 'Compiling...';
    }
    return null;
  }, [state.status, isLargeDocument, source.length]);

  return (
    <div className="large-doc-container">
      <div className="editor-section">
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="editor"
        />
        {statusMessage && (
          <div className="status-bar" role="status" aria-live="polite">
            {statusMessage}
          </div>
        )}
      </div>

      {/* PreviewPane handles its own performance warning (FR-023) */}
      <PreviewPane source={source} />

      {/* Show character count */}
      <div className="char-count">
        {source.length.toLocaleString()} characters
        {isLargeDocument && (
          <span className="warning"> (may affect performance)</span>
        )}
      </div>
    </div>
  );
}
```

**Performance considerations:**
- PreviewPane shows built-in warning at >50k chars (dismissible)
- Increase `debounceMs` for large documents (500ms recommended)
- Compilation runs in Web Worker (UI stays responsive)
- `lastSuccessfulRender` provides fallback during slow compiles

### Scenario 5: Understanding the Sandbox Security Model

The preview iframe uses a hardened sandbox. Here's how to work within its constraints.

```tsx
import { PreviewPane } from '@renderer/components/preview/PreviewPane';
import type { PreviewFrameProps } from '@renderer/components/preview/PreviewFrame';

/**
 * Security Architecture:
 *
 * ┌────────────────────────────────────────┐
 * │         RENDERER PROCESS               │
 * │  - Full access to Node.js APIs         │
 * │  - Stores, hooks, compilation          │
 * │  - Zustand state management            │
 * └───────────────────┬────────────────────┘
 *                     │ postMessage (one-way)
 *                     ▼
 * ┌────────────────────────────────────────┐
 * │     SANDBOXED IFRAME (preview)         │
 * │  sandbox="allow-scripts"               │
 * │                                        │
 * │  ALLOWED:                              │
 * │  - Execute JS (compiled MDX)           │
 * │  - Render React components             │
 * │  - Apply CSS styles                    │
 * │                                        │
 * │  BLOCKED:                              │
 * │  - Access parent DOM (no same-origin)  │
 * │  - Read localStorage/cookies           │
 * │  - Navigate parent window              │
 * │  - Make network requests (CSP)         │
 * │  - Access file system                  │
 * └────────────────────────────────────────┘
 */

function SecurePreviewExample() {
  const source = `
# Secure Preview Demo

This content renders in a sandboxed iframe.

<Callout type="info" title="Security Notice">
  The preview executes user MDX code in isolation.
  It cannot access your files, network, or session data.
</Callout>

## What's Allowed

- React component rendering
- CSS styling via CSS variables
- Image display (data URIs, https URLs)
- Interactive JavaScript within the preview

## What's Blocked

- \`fetch()\` or \`XMLHttpRequest\` (CSP: connect-src 'none')
- Accessing parent window (\`window.parent\` is restricted)
- Reading \`localStorage\` or \`document.cookie\`
- Redirecting or navigating the main window
`;

  return (
    <div className="secure-preview">
      {/* Security warning is shown automatically in PreviewPane */}
      <PreviewPane source={source} theme="light" />
    </div>
  );
}

/**
 * Handling runtime errors from untrusted MDX:
 */
function PreviewWithErrorHandling() {
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  return (
    <PreviewFrame
      code={compiledCode}
      frontmatter={{}}
      onRuntimeError={(message, componentStack) => {
        console.error('Runtime error in preview:', message);
        if (componentStack) {
          console.error('Component stack:', componentStack);
        }
        setRuntimeError(message);
      }}
    />
  );
}
```

**Security guarantees:**
| Feature | Status | Reason |
|---------|--------|--------|
| Script execution | Allowed | Required for MDX components |
| DOM manipulation | Isolated | No `allow-same-origin` |
| Network requests | Blocked | CSP `connect-src: 'none'` |
| Top navigation | Blocked | No `allow-top-navigation` |
| Form submission | Blocked | No `allow-forms` |
| Popups/modals | Blocked | No `allow-popups` |

**Why this is appropriate for mdxpad:**
- mdxpad is a local-first editor
- Users execute their own MDX code
- The warning "Preview executes code from your MDX" is displayed
- No untrusted third-party code is loaded

---

## Complete Integration Example

Putting it all together - a full editor with preview integration.

```tsx
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PreviewPane } from '@renderer/components/preview/PreviewPane';
import { usePreview } from '@renderer/hooks/usePreview';
import type { EditorView } from '@codemirror/view';

interface EditorWithPreviewProps {
  initialSource?: string;
}

export function EditorWithPreview({
  initialSource = '# Welcome to mdxpad\n\nStart typing MDX...',
}: EditorWithPreviewProps) {
  // Source state
  const [source, setSource] = useState(initialSource);

  // Theme state (synced with system)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Scroll synchronization
  const [scrollRatio, setScrollRatio] = useState(0);

  // Editor reference for cursor navigation
  const editorRef = useRef<EditorView | null>(null);

  // Use preview hook for state access
  const { state } = usePreview(source);

  // System theme sync
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mq.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Navigate to error location
  const handleErrorClick = useCallback((line: number, column?: number) => {
    const view = editorRef.current;
    if (!view) return;

    const doc = view.state.doc;
    const lineInfo = doc.line(Math.min(line, doc.lines));
    const pos = lineInfo.from + (column ? Math.min(column - 1, lineInfo.length) : 0);

    view.dispatch({
      selection: { anchor: pos },
      scrollIntoView: true,
    });
    view.focus();
  }, []);

  // Handle editor scroll for sync
  const handleEditorScroll = useCallback((view: EditorView) => {
    const { scrollTop, scrollHeight, clientHeight } = view.scrollDOM;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll > 0) {
      setScrollRatio(scrollTop / maxScroll);
    }
  }, []);

  // Status indicator
  const statusText = useMemo(() => {
    switch (state.status) {
      case 'idle': return 'Ready';
      case 'compiling': return 'Compiling...';
      case 'success': return 'Preview updated';
      case 'error': return `${state.errors.length} error(s)`;
    }
  }, [state]);

  return (
    <div className="mdxpad-editor">
      <header className="toolbar">
        <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
          Toggle Theme
        </button>
        <span className="status">{statusText}</span>
      </header>

      <div className="editor-preview-split">
        <section className="editor-section" aria-label="MDX Editor">
          <CodeMirrorEditor
            value={source}
            onChange={setSource}
            onScroll={handleEditorScroll}
            ref={editorRef}
          />
        </section>

        <section className="preview-section" aria-label="Live Preview">
          <PreviewPane
            source={source}
            theme={theme}
            scrollRatio={scrollRatio}
            onErrorClick={handleErrorClick}
          />
        </section>
      </div>
    </div>
  );
}
```

---

## Next Steps

After integrating the Preview Pane:

1. Run `/speckit.tasks` to generate implementation tasks
2. Implement tasks in order (they are dependency-sorted)
3. Run tests after each task
4. Verify performance budgets (<500ms compile, <16ms keystroke latency)
