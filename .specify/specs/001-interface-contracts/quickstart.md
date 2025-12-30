# Quickstart: Interface Contracts

**Branch**: `001-interface-contracts` | **Date**: 2025-12-30

## Prerequisites

- Node.js 22.x (per Spec 000)
- pnpm 10.x (per Constitution Article II)
- Completed Spec 000 (Foundational Setup)

## Quick Verification

After implementing this spec, verify with:

```bash
# All commands should pass
pnpm typecheck
pnpm lint
pnpm build
pnpm dev  # Should launch with UI components rendering
```

---

## Type Usage Examples

### Importing Types

```typescript
// Import all types
import {
  EditorState,
  FileHandle,
  FileState,
  CompileResult,
  IpcChannels,
  Theme,
} from '@shared/types';

// Import specific modules
import type { Selection, EditorConfig } from '@shared/types/editor';
import type { FileError, FileResult } from '@shared/types/file';
import type { PreviewState, CompileError } from '@shared/types/preview';
```

### Using the Result Monad

```typescript
import { ok, err, map, unwrapOr } from '@shared/lib/result';
import type { Result } from '@shared/lib/result';

// Creating results
const success = ok<number>(42);
const failure = err<string>('Something went wrong');

// Type-safe operations
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err('Division by zero');
  return ok(a / b);
}

// Mapping over results
const doubled = map(divide(10, 2), (n) => n * 2);
// doubled: Result<number, string>

// Safe unwrapping
const value = unwrapOr(doubled, 0); // 10 (or 0 if error)
```

### Using the TypedEventEmitter

```typescript
import { createEventEmitter } from '@shared/lib/events';

// Define your event types
interface EditorEvents {
  change: { content: string };
  save: { path: string };
  error: { message: string };
}

// Create emitter
const events = createEventEmitter<EditorEvents>();

// Subscribe (returns unsubscribe function)
const unsubscribe = events.on('change', (payload) => {
  console.log('Content changed:', payload.content);
});

// Emit events
events.emit('change', { content: 'Hello, world!' });

// Cleanup
unsubscribe();
```

### Using IPC Types

```typescript
// In preload script
import { IpcChannels, type IpcApi } from '@shared/types/ipc';
import { contextBridge, ipcRenderer } from 'electron';

// Type-safe API exposure
const api = {
  openFile: () => ipcRenderer.invoke(IpcChannels.FILE_OPEN),
  saveFile: (handle: FileHandle, content: string) =>
    ipcRenderer.invoke(IpcChannels.FILE_SAVE, handle, content),
  getVersion: () => ipcRenderer.invoke(IpcChannels.APP_VERSION),
};

contextBridge.exposeInMainWorld('api', api);

// In main process
import { ipcMain } from 'electron';
import { IpcChannels, type IpcHandler } from '@shared/types/ipc';

const handleFileOpen: IpcHandler<typeof IpcChannels.FILE_OPEN> = async () => {
  // TypeScript knows this must return Promise<FileResult<FileHandle>>
};

ipcMain.handle(IpcChannels.FILE_OPEN, handleFileOpen);
```

### Using Utility Functions

```typescript
import { cn, debounce, throttle, uid } from '@shared/lib/utils';

// Merge Tailwind classes
const className = cn(
  'px-4 py-2 rounded',
  isActive && 'bg-blue-500',
  isDisabled && 'opacity-50 cursor-not-allowed'
);

// Debounce expensive operations
const debouncedSave = debounce((content: string) => {
  saveToFile(content);
}, 500);

// Generate unique IDs
const fileId = uid(); // e.g., "x7k2m9p4"
```

---

## shadcn/ui Component Usage

```tsx
import { Button } from '@ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@ui/dialog';
import { Input } from '@ui/input';

function SaveDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Save As</Button>
      </DialogTrigger>
      <DialogContent>
        <Input placeholder="Enter filename..." />
        <Button>Save</Button>
      </DialogContent>
    </Dialog>
  );
}
```

---

## File Structure After Implementation

```
src/
├── shared/
│   ├── types/
│   │   ├── editor.ts      # EditorState, Selection, Command, etc.
│   │   ├── file.ts        # FileId, FileHandle, FileState, etc.
│   │   ├── preview.ts     # CompileResult, PreviewState, etc.
│   │   ├── ipc.ts         # IpcChannels, IpcApi, IpcHandler
│   │   ├── ui.ts          # Theme, LayoutState, etc.
│   │   └── index.ts       # Re-exports all types
│   └── lib/
│       ├── result.ts      # Result monad utilities
│       ├── events.ts      # TypedEventEmitter
│       ├── utils.ts       # cn, debounce, throttle, uid
│       └── index.ts       # Re-exports all utilities
└── renderer/
    ├── styles/
    │   └── globals.css    # Tailwind + CSS variables
    └── components/
        └── ui/            # shadcn/ui components
            ├── button.tsx
            ├── dialog.tsx
            └── ...
```

---

## Troubleshooting

### Path Aliases Not Resolving

Ensure all `tsconfig.json` files have the paths configured:

```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["./src/shared/*"],
      "@ui/*": ["./src/renderer/components/ui/*"]
    }
  }
}
```

And `vite.config.ts` has matching aliases:

```typescript
resolve: {
  alias: {
    '@shared': path.resolve(__dirname, 'src/shared'),
    '@ui': path.resolve(__dirname, 'src/renderer/components/ui')
  }
}
```

### Type Errors After Import

Make sure you're importing **types** (not runtime values) with the `type` keyword for type-only imports:

```typescript
// Correct
import type { EditorState } from '@shared/types/editor';

// Also correct (mixed import)
import { IpcChannels, type IpcApi } from '@shared/types/ipc';
```

### shadcn/ui Components Not Styled

Verify `globals.css` is imported in the renderer entry point:

```tsx
// src/renderer/index.tsx
import './styles/globals.css';
```

And contains the Tailwind import:

```css
@import 'tailwindcss';
```

---

## Next Steps

After this spec is complete:

1. **Editor Lane** can implement CodeMirror integration using `EditorState`, `Selection`, etc.
2. **Shell Lane** can implement file operations using `FileHandle`, `FileState`, `IpcChannels`
3. **Preview Lane** can implement MDX compilation using `CompileResult`, `PreviewState`
4. All lanes use `@shared/lib` utilities for consistent patterns

The types in this spec are **READ-ONLY** for parallel lanes. If a lane needs additional types, they should create a `_local/types.ts` in their directory and propose upstream after merge.
