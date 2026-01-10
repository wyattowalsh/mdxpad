# Preview System

> Real-time MDX compilation and rendering with sandboxed iframe execution.

The Preview System provides live MDX preview capabilities for mdxpad. It compiles MDX source code in a Web Worker, renders the output in a sandboxed iframe, and handles bidirectional communication for scroll synchronization and theming.

## Architecture Overview

```
                           ┌──────────────────────────────────────────────────────────┐
                           │                    RENDERER PROCESS                       │
                           │                                                           │
    ┌─────────────┐        │  ┌─────────────┐      ┌──────────────────┐               │
    │             │        │  │             │      │                  │               │
    │   Editor    │───────────▶ PreviewPane │──────▶  usePreview      │               │
    │             │  source │  │             │      │  (hook)          │               │
    └─────────────┘        │  └──────┬──────┘      └────────┬─────────┘               │
                           │         │                      │                          │
                           │         │ code                 │ compile                  │
                           │         │ frontmatter          │                          │
                           │         ▼                      ▼                          │
                           │  ┌─────────────┐      ┌──────────────────┐               │
                           │  │             │      │                  │               │
                           │  │PreviewFrame │      │ MDXCompiler      │◀──────┐       │
                           │  │             │      │ (wrapper)        │       │       │
                           │  └──────┬──────┘      └────────┬─────────┘       │       │
                           │         │                      │                 │       │
                           └─────────┼──────────────────────┼─────────────────┼───────┘
                                     │                      │                 │
                       postMessage   │            postMessage│                 │
                       (commands)    │            (request)  │                 │
                                     │                      │                 │ response
                                     ▼                      ▼                 │
                           ┌─────────────────┐     ┌──────────────────┐       │
                           │                 │     │                  │       │
                           │ SANDBOXED       │     │  WEB WORKER      │───────┘
                           │ IFRAME          │     │  mdx-compiler    │
                           │                 │     │                  │
                           │ ┌─────────────┐ │     │ ┌──────────────┐ │
                           │ │ renderer.tsx│ │     │ │ compileMdx() │ │
                           │ │             │ │     │ │              │ │
                           │ │ React App   │ │     │ │ @mdx-js/mdx  │ │
                           │ └─────────────┘ │     │ └──────────────┘ │
                           │                 │     │                  │
                           └─────────────────┘     └──────────────────┘
```

### Data Flow

```
  Source Change
       │
       ▼
 ┌───────────────┐     300ms      ┌───────────────┐
 │ usePreview    │───debounce────▶│ MDXCompiler   │
 │               │                │               │
 │ state: idle   │                │ compile()     │
 └───────────────┘                └───────┬───────┘
                                          │
                                          │ postMessage
                                          ▼
                                  ┌───────────────┐
                                  │ Web Worker    │
                                  │               │
                                  │ compileMdx()  │
                                  └───────┬───────┘
                                          │
                                          │ CompileResponse
                                          ▼
                         ┌─────────────────────────────┐
                         │                             │
                    ┌────┴────┐               ┌────────┴───────┐
                    │         │               │                │
                    ▼         │               ▼                │
             ┌───────────┐    │        ┌───────────┐           │
             │ success   │    │        │ error     │           │
             │           │    │        │           │           │
             │ code:     │    │        │ errors:   │           │
             │ frontmatter│   │        │ [{msg,    │           │
             └─────┬─────┘    │        │  line}]   │           │
                   │          │        └─────┬─────┘           │
                   │          │              │                 │
                   ▼          │              ▼                 │
           ┌─────────────┐    │    ┌─────────────────┐         │
           │PreviewFrame │    │    │ ErrorDisplay    │         │
           │             │    │    │                 │         │
           │ iframe.post │    │    │ + last success  │◀────────┘
           │  Message()  │    │    │   (fallback)    │
           └─────────────┘    │    └─────────────────┘
                              │
                              └─────── Error Recovery:
                                       Shows error overlay
                                       with last successful
                                       render behind it
```

## Component API Documentation

### PreviewPane

Main container component that orchestrates MDX compilation and rendering.

```tsx
import { PreviewPane } from '@renderer/components/preview';

function Editor() {
  const [source, setSource] = useState('# Hello World');

  return (
    <PreviewPane
      source={source}
      scrollRatio={0.5}
      theme="dark"
      onErrorClick={(line, column) => {
        // Navigate editor to error location
      }}
      className="my-preview"
    />
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `source` | `string` | **required** | MDX source text to compile and render |
| `scrollRatio` | `number` | `undefined` | Editor scroll position (0-1) for synchronization |
| `theme` | `'light' \| 'dark'` | `undefined` | Theme for preview rendering |
| `onErrorClick` | `(line: number, column?: number) => void` | `undefined` | Callback when user clicks error location |
| `className` | `string` | `''` | CSS class for styling |

#### Features

- **Debounced Compilation**: Compiles MDX after 300ms of inactivity (configurable)
- **Loading State**: Shows spinner after 100ms delay to prevent flicker
- **Error Recovery**: Displays last successful render behind error overlay
- **Performance Warning**: Alerts when document exceeds 50,000 characters
- **Scroll Sync**: Synchronizes scroll position with editor

### PreviewFrame

Sandboxed iframe component for secure MDX preview rendering.

```tsx
import { PreviewFrame } from '@renderer/components/preview';

function CustomPreview() {
  return (
    <PreviewFrame
      code={compiledCode}
      frontmatter={{ title: 'My Document' }}
      scrollRatio={0.5}
      theme="dark"
      onReady={() => console.log('Iframe ready')}
      onSizeChange={(height) => console.log('Content height:', height)}
      onRuntimeError={(msg, stack) => console.error(msg, stack)}
    />
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `code` | `string` | `undefined` | Compiled MDX JavaScript code |
| `frontmatter` | `Record<string, unknown>` | `undefined` | Parsed frontmatter for component access |
| `scrollRatio` | `number` | `undefined` | Scroll position (0-1) |
| `theme` | `'light' \| 'dark'` | `undefined` | Theme to apply |
| `onReady` | `() => void` | `undefined` | Called when iframe is ready |
| `onSizeChange` | `(height: number) => void` | `undefined` | Called when content height changes |
| `onRuntimeError` | `(message: string, stack?: string) => void` | `undefined` | Called on runtime errors |
| `className` | `string` | `''` | CSS class for styling |

### ErrorDisplay

Displays compilation errors with clickable line:column locations.

```tsx
import { ErrorDisplay } from '@renderer/components/preview';

<ErrorDisplay
  errors={[
    { message: 'Unexpected token', line: 5, column: 10 },
    { message: 'Missing closing tag', line: 12 }
  ]}
  onErrorClick={(line, column) => {
    editor.goToLine(line, column);
  }}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `errors` | `readonly CompileError[]` | **required** | Array of compilation errors |
| `onErrorClick` | `(line: number, column?: number) => void` | `undefined` | Callback for error location clicks |
| `className` | `string` | `''` | CSS class for styling |

### LoadingIndicator

Loading spinner with delayed display to prevent flicker.

```tsx
import { LoadingIndicator } from '@renderer/components/preview';

<LoadingIndicator
  isLoading={isCompiling}
  delay={100}  // ms before showing
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isLoading` | `boolean` | **required** | Whether loading indicator should show |
| `delay` | `number` | `100` | Delay in ms before showing |
| `className` | `string` | `''` | CSS class for styling |

## Hook Usage Examples

### usePreview

The primary hook for managing MDX preview state.

```tsx
import { usePreview } from '@renderer/hooks/usePreview';

function MyEditor() {
  const [source, setSource] = useState('# Hello');

  const {
    state,              // Current preview state
    lastSuccessfulRender, // Last successful compilation (for error recovery)
    scrollRatio,        // Current scroll position (0-1)
    setScrollRatio,     // Update scroll position
  } = usePreview(source, {
    debounceMs: 300,    // Debounce delay (default: 300)
    enabled: true,      // Enable/disable compilation
  });

  // Check state status
  if (state.status === 'compiling') {
    return <Loading />;
  }

  if (state.status === 'error') {
    return <Errors errors={state.errors} />;
  }

  if (state.status === 'success') {
    return <Preview code={state.result.code} />;
  }
}
```

### usePreviewStatus

Convenience hook for checking compilation status.

```tsx
import { usePreviewStatus } from '@renderer/hooks/usePreview';

function StatusBadge() {
  const status = usePreviewStatus();

  return (
    <span className={`status-${status}`}>
      {status === 'compiling' ? 'Compiling...' : status}
    </span>
  );
}
```

### usePreviewStore

Direct Zustand store access for advanced use cases.

```tsx
import { usePreviewStore, selectErrors } from '@renderer/stores/preview-store';

function ErrorCount() {
  // Use selector for optimized re-renders
  const errors = usePreviewStore(selectErrors);

  return <span>{errors.length} errors</span>;
}

// Available selectors:
// - selectStatus: Get current status
// - selectIsCompiling: Check if compiling
// - selectIsError: Check if in error state
// - selectIsSuccess: Check if in success state
// - selectErrors: Get error array (empty if not in error state)
// - selectSuccessResult: Get success result (null if not success)
// - selectRenderableContent: Get current or last successful content
// - selectLastSuccessfulRender: Get last successful render
// - selectScrollRatio: Get scroll position
```

## Error Handling Patterns

### Compilation Errors

Compilation errors are caught during MDX compilation and include position information:

```tsx
interface CompileError {
  message: string;      // Error message
  line?: number;        // Line number (1-based)
  column?: number;      // Column number (1-based)
  source?: string;      // Error source identifier
}
```

Handle them in the PreviewPane via `onErrorClick`:

```tsx
<PreviewPane
  source={source}
  onErrorClick={(line, column) => {
    // Navigate to error location in editor
    editor.setCursor({ line: line - 1, ch: column ? column - 1 : 0 });
    editor.focus();
  }}
/>
```

### Runtime Errors

Runtime errors occur during MDX execution in the iframe. They are caught by the ErrorBoundary and reported via `onRuntimeError`:

```tsx
<PreviewFrame
  code={code}
  onRuntimeError={(message, componentStack) => {
    // Log to error tracking service
    errorTracker.captureError(new Error(message), {
      componentStack,
      context: 'mdx-preview',
    });
  }}
/>
```

### Error Recovery Pattern

The preview system maintains the last successful render for error recovery:

```tsx
function Preview() {
  const { state, lastSuccessfulRender } = usePreview(source);

  // Show error overlay with last good content behind it
  const contentToRender =
    state.status === 'success'
      ? state.result
      : lastSuccessfulRender;

  return (
    <div className="preview">
      {state.status === 'error' && (
        <ErrorOverlay errors={state.errors} />
      )}
      {contentToRender && (
        <PreviewFrame code={contentToRender.code} />
      )}
    </div>
  );
}
```

### Retry with Exponential Backoff

The MDX compiler automatically retries transient failures:

```tsx
// Default retry configuration
const retryConfig = {
  maxRetries: 3,        // Maximum retry attempts
  baseDelayMs: 100,     // Base delay for exponential backoff
  maxDelayMs: 2000,     // Maximum delay cap
};

// Transient errors (retried):
// - Worker crashed
// - Worker is unhealthy
// - Worker terminated
// - Compilation timed out

// Non-transient errors (not retried):
// - Syntax errors
// - MDX parsing errors
// - Any other compilation error
```

## Security Considerations

### Iframe Sandboxing

The preview iframe runs with strict sandboxing per FR-002:

```html
<iframe sandbox="allow-scripts" />
```

This restricts the iframe from:
- Accessing the parent window's DOM
- Opening popups or new windows
- Accessing cookies or local storage
- Making network requests (except images over HTTPS)
- Accessing the parent's origin

### Content Security Policy

The iframe has a strict CSP (FR-017):

```
default-src 'none';
script-src 'self' blob:;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'none';
base-uri 'none';
object-src 'none';
form-action 'none';
frame-ancestors 'self';
```

### Origin Validation

The iframe validates message origins before processing:

```typescript
// Allowed origins:
// - 'file://' for Electron local files
// - 'null' for sandboxed iframes
// - localhost:* in development mode
// - Same origin as window.location
```

### Code Execution Warning

The PreviewPane displays a warning about code execution:

```tsx
<div className="preview-warning" role="status">
  Preview executes code from your MDX
</div>
```

## Performance Tips

### 1. Use Debouncing

The default 300ms debounce is tuned for balance between responsiveness and CPU usage:

```tsx
// For slower machines, increase debounce
usePreview(source, { debounceMs: 500 });

// For fast machines, decrease for more responsive feel
usePreview(source, { debounceMs: 150 });
```

### 2. Disable When Hidden

Pause compilation when the preview is not visible:

```tsx
const isVisible = usePreviewVisibility();

usePreview(source, {
  enabled: isVisible,  // Pauses compilation when hidden
});
```

### 3. Monitor Large Documents

Documents over 50,000 characters trigger a performance warning. Consider:

- Splitting large documents
- Showing partial previews
- Reducing update frequency

```tsx
const LARGE_DOC_THRESHOLD = 50000;

usePreview(source, {
  debounceMs: source.length > LARGE_DOC_THRESHOLD ? 500 : 300,
});
```

### 4. Use Selectors for Store Access

Use Zustand selectors to prevent unnecessary re-renders:

```tsx
// BAD: Re-renders on any store change
const store = usePreviewStore();
const status = store.state.status;

// GOOD: Only re-renders when status changes
const status = usePreviewStore(selectStatus);
```

### 5. Module Caching

The iframe caches up to 10 compiled MDX modules to avoid re-evaluation:

```typescript
// Cache is automatically managed
// Oldest entries are evicted when full
const MAX_CACHE_SIZE = 10;
```

### 6. Avoid Unnecessary Scroll Updates

Scroll position is synchronized via `requestAnimationFrame`:

```tsx
// Scroll is rate-limited to animation frames
// No need to throttle on the parent side
<PreviewFrame scrollRatio={scrollRatio} />
```

## Troubleshooting Guide

### Preview Not Updating

1. **Check compilation status**
   ```tsx
   const status = usePreviewStatus();
   console.log('Status:', status);
   ```

2. **Check for errors in console**
   - Look for `[MDX Worker]` or `[Preview]` prefixed messages

3. **Verify source is changing**
   ```tsx
   useEffect(() => {
    console.log('Source changed:', source.length, 'chars');
   }, [source]);
   ```

4. **Check if enabled**
   ```tsx
   usePreview(source, { enabled: true }); // Ensure enabled
   ```

### Iframe Not Loading

1. **Check iframe ready timeout**
   - Default timeout is 5 seconds
   - Look for: "Preview iframe failed to initialize"

2. **Verify iframe src**
   ```tsx
   // Check if preview-frame/index.html exists
   console.log('Iframe src:', PREVIEW_FRAME_SRC);
   ```

3. **Check for CSP violations**
   - Open DevTools > Console
   - Look for "Refused to..." messages

### Errors Not Clickable

1. **Verify onErrorClick prop**
   ```tsx
   <PreviewPane
     onErrorClick={(line, col) => {
       console.log('Clicked:', line, col);
     }}
   />
   ```

2. **Check error has line information**
   - Some errors don't include position info
   - Button only renders when `error.line` is defined

### Worker Crashes

1. **Check source size**
   - Maximum: 500,000 characters
   - Larger documents are rejected

2. **Look for infinite loops in MDX**
   - Worker has 30-second timeout
   - Complex calculations can trigger timeout

3. **Check for worker recovery**
   - Worker automatically recovers from crashes
   - Look for "[MDX Worker] Recreating worker..."

### Theme Not Applying

1. **Verify theme prop**
   ```tsx
   <PreviewPane theme="dark" />
   ```

2. **Check iframe ready state**
   - Theme is sent after iframe signals ready
   - May need to wait for initialization

3. **Inspect data-theme attribute**
   - In iframe DevTools, check `document.documentElement`
   - Should have `data-theme="dark"` or `data-theme="light"`

### Scroll Sync Issues

1. **Check scrollRatio range**
   - Must be between 0 and 1
   - Values are clamped automatically

2. **Verify iframe is ready**
   - Scroll commands are queued until ready
   - Use `onReady` callback to confirm

3. **Check for reduced motion**
   - Smooth scrolling is disabled when user prefers reduced motion
   - Uses `prefers-reduced-motion: reduce` media query

## File Structure

```
src/
├── renderer/
│   ├── components/
│   │   └── preview/
│   │       ├── index.ts           # Public exports
│   │       ├── PreviewPane.tsx    # Main container
│   │       ├── PreviewFrame.tsx   # Sandboxed iframe
│   │       ├── ErrorDisplay.tsx   # Error rendering
│   │       ├── LoadingIndicator.tsx # Loading spinner
│   │       └── README.md          # This documentation
│   ├── hooks/
│   │   └── usePreview.ts          # Preview hook
│   ├── stores/
│   │   └── preview-store.ts       # Zustand store
│   ├── lib/
│   │   └── mdx/
│   │       ├── compiler.ts        # Worker interface
│   │       └── compile.ts         # Core compilation
│   ├── workers/
│   │   └── mdx-compiler.worker.ts # Web Worker
│   └── styles/
│       └── preview/
│           ├── index.css          # Main styles
│           ├── error.css          # Error styles
│           ├── code.css           # Code highlighting
│           ├── components.css     # Component styles
│           └── theme.css          # Theme variables
├── preview-frame/
│   ├── index.html                 # Iframe HTML
│   ├── renderer.tsx               # React entry point
│   └── components/
│       ├── index.ts               # Component registry
│       ├── ErrorBoundary.tsx      # Runtime error handling
│       ├── typography.tsx         # Typography components
│       ├── CodeBlock.tsx          # Code blocks
│       ├── Callout.tsx            # Callout boxes
│       ├── Tabs.tsx               # Tab panels
│       ├── Card.tsx               # Cards and grids
│       └── FileTree.tsx           # File tree component
└── shared/
    └── types/
        ├── preview.ts             # Shared types
        ├── preview-iframe.ts      # Iframe message types
        └── preview-worker.ts      # Worker message types
```
