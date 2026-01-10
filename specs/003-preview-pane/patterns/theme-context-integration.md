# Theme Context Integration Pattern for PreviewPane

**Feature**: 003-preview-pane
**Task Reference**: T039 (prepare context integration for T014)
**Date**: 2026-01-09
**Status**: Pattern Documentation

## Overview

This document describes how PreviewPane will subscribe to the application's theme context and propagate theme changes to the sandboxed preview iframe. This pattern supports User Story 6 (Theme Synchronization) and meets FR-021.

---

## Requirements Summary

From `spec.md`:
- **FR-021**: System MUST inherit the application theme (light/dark) in the preview container
- **SC-007**: Theme changes reflect in the preview within 100ms without requiring page reload

From `data-model.md`:
- Theme state is stored in the preview store: `theme: 'light' | 'dark'`
- Theme changes do NOT trigger recompilation (state invariant #4)

---

## Existing Infrastructure

### PreviewFrame Props (Already Implemented)

```typescript
// src/renderer/components/preview/PreviewFrame.tsx
export interface PreviewFrameProps {
  /** Theme value */
  readonly theme?: 'light' | 'dark';
  // ... other props
}
```

PreviewFrame already:
1. Accepts a `theme` prop
2. Sends `ThemeCommand` to iframe when theme changes
3. Handles initial theme on iframe ready signal

### ThemeCommand (Already Defined)

```typescript
// src/shared/types/preview-iframe.ts
export interface ThemeCommand {
  readonly type: 'theme';
  readonly value: 'light' | 'dark';
}
```

### Preview Store (Already Has Theme)

```typescript
// src/renderer/stores/preview-store.ts
export interface PreviewStore {
  readonly theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  // ... other state
}
```

---

## Integration Patterns

### Recommendation: Accept Theme as Prop (Primary)

PreviewPane should accept theme as a prop for maximum flexibility. This allows the parent component to wire theme from any source (context, prop drilling, store).

```typescript
// src/renderer/components/preview/PreviewPane.tsx

export interface PreviewPaneProps {
  /** MDX source text to compile and render */
  readonly source: string;

  /** Theme for preview rendering. If omitted, defaults to 'light'. */
  readonly theme?: 'light' | 'dark';

  /** Editor scroll position for synchronization (0-1) */
  readonly scrollRatio?: number;

  /** Callback when preview state changes */
  readonly onStateChange?: (state: PreviewState) => void;

  /** Callback when user clicks error line number */
  readonly onErrorClick?: (line: number, column?: number) => void;

  /** CSS class for styling */
  readonly className?: string;
}
```

**Rationale**:
1. **Flexibility**: Parent can source theme from context, store, or explicit prop
2. **Testability**: Easy to test with explicit prop values
3. **Reusability**: Works in contexts that don't have a ThemeContext
4. **Separation of concerns**: PreviewPane stays focused on preview rendering

---

### Pattern A: Parent Wires to App Context

When the application has a global theme context, the parent component subscribes and passes to PreviewPane:

```typescript
// Hypothetical app theme context
interface ThemeContextValue {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

// In parent component that renders PreviewPane
import { useTheme } from '@/renderer/contexts/ThemeContext';
import { PreviewPane } from '@/renderer/components/preview';

function EditorLayout() {
  const { theme } = useTheme();
  const [source, setSource] = useState('');

  return (
    <div className="editor-layout">
      <Editor onChange={setSource} />
      <PreviewPane
        source={source}
        theme={theme}
      />
    </div>
  );
}
```

---

### Pattern B: Use Preview Store Theme

If using the preview store as the theme source:

```typescript
import { usePreviewStore } from '@/renderer/stores/preview-store';
import { PreviewPane } from '@/renderer/components/preview';

function EditorLayout() {
  const theme = usePreviewStore((s) => s.theme);
  const [source, setSource] = useState('');

  return (
    <PreviewPane
      source={source}
      theme={theme}
    />
  );
}
```

---

### Pattern C: Optional Context Hook Within PreviewPane

If you want PreviewPane to optionally subscribe to context when available, but fall back gracefully:

```typescript
// src/renderer/components/preview/PreviewPane.tsx

import * as React from 'react';
import { useContext } from 'react';

// Define a minimal theme context type that PreviewPane can optionally use
interface OptionalThemeContext {
  theme: 'light' | 'dark';
}

// This context may or may not exist in the app
const ThemeContext = React.createContext<OptionalThemeContext | null>(null);

// Optional hook that returns context if available
function useOptionalTheme(): 'light' | 'dark' | undefined {
  const context = useContext(ThemeContext);
  return context?.theme;
}

export interface PreviewPaneProps {
  readonly source: string;
  /** Theme override. If omitted, uses context or defaults to 'light'. */
  readonly theme?: 'light' | 'dark';
  // ... other props
}

export function PreviewPane({
  source,
  theme: themeProp,
  // ... other props
}: PreviewPaneProps) {
  // Priority: prop > context > default
  const contextTheme = useOptionalTheme();
  const theme = themeProp ?? contextTheme ?? 'light';

  return (
    <PreviewFrame
      code={/* compiled code */}
      theme={theme}
      // ...
    />
  );
}
```

**Note**: Pattern C adds complexity. Pattern A (parent wires context) is recommended.

---

## Implementation Guide for T014

When implementing PreviewPane in T014, use this structure:

```typescript
// src/renderer/components/preview/PreviewPane.tsx

import * as React from 'react';
import { PreviewFrame } from './PreviewFrame';
import { LoadingIndicator } from './LoadingIndicator';
import { ErrorDisplay } from './ErrorDisplay';
import { usePreview } from '@/renderer/hooks/usePreview';
import type { PreviewState, CompileError } from '@shared/types/preview';

export interface PreviewPaneProps {
  /** MDX source text to compile and render */
  readonly source: string;

  /** Theme for preview rendering */
  readonly theme?: 'light' | 'dark';

  /** Editor scroll position (0-1) for synchronization */
  readonly scrollRatio?: number;

  /** Callback when preview state changes */
  readonly onStateChange?: (state: PreviewState) => void;

  /** Callback when user clicks an error location */
  readonly onErrorClick?: (line: number, column?: number) => void;

  /** CSS class for styling */
  readonly className?: string;
}

export function PreviewPane({
  source,
  theme = 'light',  // Default to light theme
  scrollRatio,
  onStateChange,
  onErrorClick,
  className = '',
}: PreviewPaneProps): React.ReactNode {
  // Get compilation state from hook (T009)
  const { state, lastSuccessfulCode, frontmatter } = usePreview(source);

  // Notify parent of state changes
  React.useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Render based on state
  return (
    <div className={`preview-pane ${className}`.trim()}>
      {/* Security warning (FR-025) */}
      <div className="preview-warning" role="alert">
        Preview executes code from your MDX
      </div>

      {/* Loading indicator */}
      {state.status === 'compiling' && <LoadingIndicator />}

      {/* Error display */}
      {state.status === 'error' && (
        <ErrorDisplay
          errors={state.errors}
          onErrorClick={onErrorClick}
        />
      )}

      {/* Preview frame - renders last successful or current */}
      <PreviewFrame
        code={state.status === 'success' ? state.result.code : lastSuccessfulCode}
        frontmatter={frontmatter}
        theme={theme}           // <-- Theme passed through
        scrollRatio={scrollRatio}
        className={state.status === 'error' ? 'preview-frame--hidden' : ''}
      />
    </div>
  );
}

export default PreviewPane;
```

---

## Theme Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                             │
│                                                                  │
│  ┌──────────────────┐     theme      ┌──────────────────────┐   │
│  │  ThemeContext    │ ─────────────▶ │   EditorLayout       │   │
│  │  (or Store)      │                │   (parent component) │   │
│  └──────────────────┘                └──────────────────────┘   │
│                                                │                 │
│                                         theme prop               │
│                                                │                 │
│                                                ▼                 │
│                                      ┌──────────────────────┐   │
│                                      │     PreviewPane      │   │
│                                      │ (accepts theme prop) │   │
│                                      └──────────────────────┘   │
│                                                │                 │
│                                         theme prop               │
│                                                │                 │
│                                                ▼                 │
│                                      ┌──────────────────────┐   │
│                                      │    PreviewFrame      │   │
│                                      │ (sends ThemeCommand) │   │
│                                      └──────────────────────┘   │
│                                                │                 │
│                                     postMessage(ThemeCommand)    │
└────────────────────────────────────────────────┼────────────────┘
                                                 │
                              ┌──────────────────┴──────────────────┐
                              │         SANDBOXED IFRAME             │
                              │                                      │
                              │  ┌────────────────────────────────┐  │
                              │  │     renderer.tsx               │  │
                              │  │  - Receives ThemeCommand       │  │
                              │  │  - Sets data-theme attribute   │  │
                              │  │  - CSS variables update        │  │
                              │  └────────────────────────────────┘  │
                              └──────────────────────────────────────┘
```

---

## Performance Considerations

1. **No recompilation on theme change**: Theme is purely cosmetic and sent directly to iframe
2. **Efficient propagation**: PreviewFrame has `useEffect` that sends ThemeCommand only when theme prop changes
3. **Sub-100ms updates**: PostMessage is near-instantaneous; CSS variable updates are instant

---

## Testing Considerations

```typescript
// Unit test: PreviewPane accepts theme prop
it('passes theme to PreviewFrame', () => {
  render(<PreviewPane source="# Hello" theme="dark" />);
  // Verify PreviewFrame received theme="dark"
});

// Integration test: Theme propagates to iframe
it('sends ThemeCommand when theme changes', async () => {
  const { rerender } = render(<PreviewPane source="# Hello" theme="light" />);
  // Wait for iframe ready
  rerender(<PreviewPane source="# Hello" theme="dark" />);
  // Verify ThemeCommand was posted
});
```

---

## Summary

| Pattern | Pros | Cons | Recommendation |
|---------|------|------|----------------|
| Prop from parent | Flexible, testable, explicit | Requires parent wiring | **Recommended** |
| Direct context subscription | Self-contained | Tight coupling, less flexible | Not recommended |
| Optional context with fallback | Works with/without context | Complex, magic behavior | Use sparingly |

**Final Recommendation**: Accept `theme` as a prop on PreviewPane. Parent component is responsible for sourcing theme from context, store, or explicit value. This provides maximum flexibility while maintaining clear data flow.
