# onErrorClick Callback Pattern

**Task**: T020 (Batch 5)
**User Story**: US2 - Compilation Error Display
**Status**: Preparation for T014 (PreviewPane)

## Overview

The `onErrorClick` callback enables navigation from error locations in the preview pane to the corresponding positions in the editor. When users click on an error's line:column information, this callback is invoked, allowing the parent component to navigate the editor to that location.

## Type Definition

```typescript
interface PreviewPaneProps {
  /** MDX source content to compile and preview */
  source: string;

  /** Scroll position ratio for synchronization (0-1) */
  scrollRatio?: number;

  /** Theme for preview rendering */
  theme?: 'light' | 'dark';

  /** Callback when user clicks on error location to navigate editor */
  onErrorClick?: (line: number, column?: number) => void;

  /** CSS class for styling */
  className?: string;
}
```

## Callback Flow

```
                    User clicks error location
                              |
                              v
+-------------------+    +-----------------+    +------------------+
|   ErrorDisplay    | -> |   PreviewPane   | -> | Parent Component |
| (button onClick)  |    | (prop passthru) |    | (editor.goToLine)|
+-------------------+    +-----------------+    +------------------+
```

1. **ErrorDisplay** - Renders clickable error locations (line:column buttons)
2. **PreviewPane** - Passes `onErrorClick` through to ErrorDisplay
3. **Parent Component** - Receives callback and navigates editor

## ErrorDisplay Implementation (T017 - Complete)

The ErrorDisplay component already accepts and uses `onErrorClick`:

```typescript
// src/renderer/components/preview/ErrorDisplay.tsx

export interface ErrorDisplayProps {
  /** Array of compilation errors to display */
  readonly errors: CompileError[];
  /** Callback when user clicks on error location */
  readonly onErrorClick?: (line: number, column?: number) => void;
  /** CSS class for styling */
  readonly className?: string;
}

// Inside component:
const handleLocationClick = (
  event: React.MouseEvent | React.KeyboardEvent,
  line: number,
  column?: number
): void => {
  if (
    event.type === 'click' ||
    (event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Enter' ||
        (event as React.KeyboardEvent).key === ' '))
  ) {
    event.preventDefault();
    onErrorClick?.(line, column);
  }
};

// Rendered as accessible button:
<button
  type="button"
  className="preview-error-location"
  onClick={(e) => handleLocationClick(e, error.line!, error.column)}
  onKeyDown={(e) => handleLocationClick(e, error.line!, error.column)}
  aria-label={`Go to ${formatLocation(error.line, error.column)}`}
>
  {formatLocation(error.line, error.column)}
</button>
```

## PreviewPane Integration (T014 - Implementation)

When implementing PreviewPane, pass through `onErrorClick` to ErrorDisplay:

```typescript
// src/renderer/components/preview/PreviewPane.tsx

import { ErrorDisplay } from './ErrorDisplay';
import { PreviewFrame } from './PreviewFrame';
import { LoadingIndicator } from './LoadingIndicator';
import type { PreviewState, CompileError } from '@shared/types/preview';

export interface PreviewPaneProps {
  /** MDX source content to compile and preview */
  source: string;
  /** Scroll position ratio for synchronization (0-1) */
  scrollRatio?: number;
  /** Theme for preview rendering */
  theme?: 'light' | 'dark';
  /** Callback when user clicks on error location to navigate editor */
  onErrorClick?: (line: number, column?: number) => void;
  /** CSS class for styling */
  className?: string;
}

export function PreviewPane({
  source,
  scrollRatio,
  theme,
  onErrorClick,
  className = '',
}: PreviewPaneProps): React.ReactNode {
  // Use the preview hook to get compilation state
  const { state } = usePreview(source);

  return (
    <div className={`preview-pane ${className}`.trim()}>
      {/* Security warning per FR-025 */}
      <div className="preview-warning" aria-live="polite">
        Preview executes code from your MDX
      </div>

      {/* Conditional rendering based on state */}
      {state.status === 'compiling' && <LoadingIndicator />}

      {state.status === 'error' && (
        <ErrorDisplay
          errors={state.errors}
          onErrorClick={onErrorClick}
        />
      )}

      {state.status === 'success' && (
        <PreviewFrame
          code={state.result.code}
          frontmatter={state.result.frontmatter}
          scrollRatio={scrollRatio}
          theme={theme}
        />
      )}
    </div>
  );
}
```

## Parent Component Usage

```typescript
// Example: In the main editor layout component

import { useRef } from 'react';
import { PreviewPane } from '@renderer/components/preview';
import type { EditorRef } from '@renderer/components/editor';

function EditorLayout() {
  const editorRef = useRef<EditorRef>(null);
  const [source, setSource] = useState('');
  const [scrollRatio, setScrollRatio] = useState(0);

  /**
   * Handle error click from preview pane.
   * Navigates the editor to the specified line and column.
   */
  function handleErrorClick(line: number, column?: number): void {
    // Navigate editor to error location
    editorRef.current?.goToLine(line, column);

    // Optionally focus the editor
    editorRef.current?.focus();
  }

  return (
    <div className="editor-layout">
      <Editor
        ref={editorRef}
        value={source}
        onChange={setSource}
        onScroll={setScrollRatio}
      />
      <PreviewPane
        source={source}
        scrollRatio={scrollRatio}
        onErrorClick={handleErrorClick}
      />
    </div>
  );
}
```

## Accessibility Considerations

The ErrorDisplay component implements accessibility features:

1. **Button element** - Uses `<button>` for keyboard accessibility
2. **Keyboard support** - Handles Enter and Space key presses
3. **ARIA label** - Provides descriptive label: "Go to Line X, Column Y"
4. **Role alert** - Error container has `role="alert"` for screen readers
5. **Live region** - Uses `aria-live="polite"` for dynamic updates

## Related Files

| File | Purpose |
|------|---------|
| `src/renderer/components/preview/ErrorDisplay.tsx` | Error display with clickable locations (T017) |
| `src/renderer/components/preview/PreviewPane.tsx` | Main container passing through callback (T014) |
| `src/shared/types/preview.ts` | CompileError type definition |
| `src/renderer/styles/preview/error.css` | Error styling (T018) |

## Verification Checklist

- [x] ErrorDisplay accepts `onErrorClick` prop (T017 complete)
- [x] ErrorDisplay renders clickable line:column buttons
- [x] ErrorDisplay handles keyboard accessibility (Enter/Space)
- [ ] PreviewPane accepts `onErrorClick` prop (T014 pending)
- [ ] PreviewPane passes `onErrorClick` to ErrorDisplay (T014 pending)
- [ ] Integration test: click error -> editor navigates (T047 pending)
