# Keyboard Shortcut Registration Research

## Feature Context
- **Shortcut**: `Cmd/Ctrl+Shift+F` to focus filter input from anywhere in app
- **Requirement**: Must work regardless of current focus (FR-006)
- **Conflict Detection**: Need to handle existing shortcuts

---

## Decision: React Event Handler with Menu Accelerator Registration

**Recommended Approach**: Use **React-side keyboard event handling** via the existing `useKeyboardShortcuts` hook combined with **Electron Menu accelerator registration** for discoverability.

---

## Rationale

### Why React Event Handling (Primary)

1. **Codebase Alignment**: The mdxpad codebase already has a robust keyboard shortcut system:
   - `useKeyboardShortcuts.ts` hook handles global keyboard events
   - `command-registry-store.ts` manages shortcut-to-command mappings
   - Conflict detection via `detectConflicts()` method already implemented
   - Platform abstraction via `Mod` modifier (resolves to Cmd on macOS, Ctrl elsewhere)

2. **Focus Management Integration**: React refs provide direct DOM access needed for:
   ```typescript
   // Pattern from codebase: EditorPane uses editorRef
   const filterInputRef = useRef<HTMLInputElement>(null);
   filterInputRef.current?.focus();
   ```

3. **Shortcut Bypass for Input Fields**: The existing hook already handles the edge case:
   ```typescript
   // From useKeyboardShortcuts.ts lines 107-116
   if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
     if (event.key !== 'Escape') return; // Only Escape bypasses input
   }
   ```
   This needs modification to also allow `Mod+Shift+F` to pass through when targeting the filter.

4. **Command Registry Integration**: Can leverage existing infrastructure:
   - Register as `filter.focus` command
   - Automatic conflict detection with `Mod+Shift+F` against existing shortcuts
   - Appears in command palette for discoverability

### Why Menu Accelerator (Secondary)

1. **Native Menu Visibility**: Adding to Edit or View menu makes shortcut discoverable
2. **OS Integration**: Native menus show proper glyph symbols (e.g., `Shift+F`)
3. **Accessibility**: Screen readers announce menu item shortcuts

### Why NOT globalShortcut

1. **Overkill**: `globalShortcut` works when app is **unfocused** - not needed here
2. **OS Conflicts**: Global shortcuts can conflict with other applications silently
3. **Security Concerns**: Requires additional permissions on macOS Mojave+
4. **Complexity**: Requires IPC coordination between main and renderer processes

---

## Alternatives Considered

### Alternative 1: Electron globalShortcut Only

**Approach**: Register shortcut in main process with `globalShortcut.register('CommandOrControl+Shift+F', callback)`

**Pros**:
- Works even when app is unfocused
- Native OS-level registration

**Cons**:
- Requires IPC to send focus command to renderer
- Global shortcuts can conflict with other apps (silent failure)
- Overkill - we only need in-app focus, not system-wide
- More complex architecture crossing process boundaries
- macOS accessibility permissions required for some shortcuts

**Verdict**: Rejected - unnecessary complexity for in-app functionality

### Alternative 2: Menu Accelerator Only

**Approach**: Define shortcut solely in Electron menu with `accelerator: 'CmdOrCtrl+Shift+F'`

**Pros**:
- Simple implementation in `menu.ts`
- Native menu shows shortcut
- Works via IPC event (`window.webContents.send`)

**Cons**:
- Menu accelerators only work when **menu is visible** in some cases
- No integration with command registry for conflict detection
- Separate code path from other shortcuts

**Verdict**: Rejected as primary - good for discoverability but not reliable as sole mechanism

### Alternative 3: External Library (mousetrap, react-hotkeys)

**Approach**: Use third-party keyboard library

**Pros**:
- Battle-tested implementations
- Rich feature sets

**Cons**:
- Additional dependency
- Duplicates functionality already in codebase
- May conflict with existing `useKeyboardShortcuts` hook
- Learning curve for team

**Verdict**: Rejected - codebase already has equivalent functionality

### Alternative 4: before-input-event in Main Process

**Approach**: Intercept keyboard events in Electron's main process before they reach renderer

**Pros**:
- Can catch shortcuts before any JavaScript handler
- Works regardless of focus state

**Cons**:
- Cross-process complexity
- Harder to debug
- Overkill for this use case

**Verdict**: Rejected - appropriate for system-level shortcuts, not UI focus

---

## Conflict Detection Analysis

### Existing Shortcuts in Codebase

| Shortcut | Command | Potential Conflict |
|----------|---------|-------------------|
| `Mod+Shift+P` | Command Palette | None |
| `Mod+Shift+S` | Save As | None |
| `Mod+Shift+B` | Toggle Sidebar | None |
| `Mod+Shift+O` | Toggle Outline | None |
| `Mod+Shift+K` | Insert Code Block | None |
| `Mod+Shift+Z` | Redo | None |
| `Mod+Shift+F` | **Find and Replace** | **CONFLICT** |

### Conflict Resolution

**Finding**: `Mod+Shift+F` is already registered for `edit.find-replace` command in `editor-commands.ts`:

```typescript
const findReplaceCommand = createEditorCommand(
  'edit.find-replace' as CommandId,
  'Find and Replace',
  'Open find and replace dialog',
  'findReplace',
  { key: 'f', modifiers: ['Mod', 'Shift'] }  // <-- Conflict!
);
```

**Resolution Options**:

1. **Change Filter Shortcut**: Use `Mod+Shift+E` (E for Explorer) or `Mod+P` (like VS Code's file switcher)
   - Pros: No conflict, familiar to VS Code users
   - Cons: Deviates from spec clarification

2. **Context-Aware Shortcut**: `Mod+Shift+F` focuses filter when file explorer has focus, triggers Find/Replace when editor has focus
   - Pros: Both features accessible
   - Cons: Non-deterministic, confusing UX

3. **Reassign Find/Replace**: Change Find/Replace to `Mod+H` (common alternative)
   - Pros: Keeps `Mod+Shift+F` for filter per spec
   - Cons: Breaking change for existing users

4. **Override with Priority**: Filter command takes precedence as it's a global focus action
   - Pros: Filter is the "jump to" action, should be global
   - Cons: Find/Replace becomes inaccessible via shortcut when file tree visible

**Recommendation**: Option 1 - Use `Mod+P` for filter focus (matches VS Code's "Quick Open" mental model for file finding). This requires updating the spec clarification.

---

## Implementation Plan

### 1. Register Filter Focus Command

```typescript
// src/renderer/commands/filter-commands.ts
const focusFilterCommand: Command = {
  id: 'filter.focus' as CommandId,
  name: 'Focus File Filter',
  description: 'Jump to file tree filter input',
  category: 'view',
  shortcut: { key: 'p', modifiers: ['Mod'] }, // Or 'f' with ['Mod', 'Shift'] if conflict resolved
  execute: (ctx: CommandContext): CommandResult => {
    // Dispatch custom event or use store action
    window.dispatchEvent(new CustomEvent('mdxpad:focus-filter'));
    return { ok: true };
  },
};
```

### 2. Listen in Filter Component

```typescript
// src/renderer/components/filter/FilterInput.tsx
const filterInputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  const handleFocusFilter = () => {
    filterInputRef.current?.focus();
  };
  window.addEventListener('mdxpad:focus-filter', handleFocusFilter);
  return () => window.removeEventListener('mdxpad:focus-filter', handleFocusFilter);
}, []);
```

### 3. Add Menu Item for Discoverability

```typescript
// src/main/menu.ts - in buildViewMenu()
{
  label: 'Focus File Filter',
  accelerator: 'CmdOrCtrl+P', // Or CmdOrCtrl+Shift+F
  click: () => window.webContents.send('mdxpad:menu:focus-filter'),
},
```

### 4. Modify Input Bypass Logic

```typescript
// src/renderer/hooks/useKeyboardShortcuts.ts
// Update lines 107-116 to allow filter focus shortcut through
if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
  // Allow Escape and filter focus shortcut
  const isFilterFocus = event.key.toLowerCase() === 'p' && modKey; // or 'f' with shift
  if (event.key !== 'Escape' && !isFilterFocus) return;
}
```

---

## Platform Considerations

| Platform | Modifier | Display | Notes |
|----------|----------|---------|-------|
| macOS | `Cmd` | `Cmd+P` | Uses Meta key, displays as glyph |
| Windows | `Ctrl` | `Ctrl+P` | Standard Ctrl usage |
| Linux | `Ctrl` | `Ctrl+P` | Same as Windows |

The existing `Mod` abstraction in `useKeyboardShortcuts.ts` handles this automatically:

```typescript
const isMac = navigator.platform.includes('Mac');
const modKey = isMac ? event.metaKey : event.ctrlKey;
```

---

## Summary

| Aspect | Recommendation |
|--------|----------------|
| **Primary Handler** | React `useKeyboardShortcuts` hook + command registry |
| **Secondary Handler** | Electron Menu accelerator for discoverability |
| **Shortcut** | `Mod+P` (to avoid conflict with Find/Replace) |
| **Focus Mechanism** | useRef + custom event dispatch |
| **Conflict Detection** | Leverage existing `detectConflicts()` in command registry |
| **NOT Recommended** | Electron globalShortcut (overkill), external libraries (redundant) |

---

## References

- Electron Keyboard Shortcuts: https://electronjs.org/docs/latest/tutorial/keyboard-shortcuts
- Existing implementation: `/Users/ww/dev/projects/mdxpad-filter/src/renderer/hooks/useKeyboardShortcuts.ts`
- Command registry: `/Users/ww/dev/projects/mdxpad-filter/src/renderer/stores/command-registry-store.ts`
- Menu implementation: `/Users/ww/dev/projects/mdxpad-filter/src/main/menu.ts`
- Editor commands (conflict): `/Users/ww/dev/projects/mdxpad-filter/src/renderer/commands/editor-commands.ts`
