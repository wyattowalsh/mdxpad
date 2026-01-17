# Quickstart: Keyboard Shortcuts & Command Palette

**Feature Branch**: `005-command-palette`
**Date**: 2026-01-10

---

## Overview

This feature adds a VS Code-style command palette and keyboard shortcuts system to mdxpad. Users can discover and execute any command via `Cmd+Shift+P`, and power users can use direct keyboard shortcuts for common operations.

---

## Getting Started

### Opening the Command Palette

Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux) to open the command palette. Type to search for commands.

**Keyboard Navigation:**
- `↓` / `↑` — Navigate options
- `Enter` — Execute selected command
- `Escape` — Close palette

---

## Built-in Shortcuts

### File Operations (Global)

| Shortcut | Command | Description |
|----------|---------|-------------|
| `Cmd+N` | New | Create new document |
| `Cmd+O` | Open | Open existing file |
| `Cmd+S` | Save | Save current document |
| `Cmd+Shift+S` | Save As | Save with new name |
| `Cmd+W` | Close | Close current document |

### Editor Operations (When Editor Focused)

| Shortcut | Command | Description |
|----------|---------|-------------|
| `Cmd+B` | Bold | Bold selected text |
| `Cmd+I` | Italic | Italicize selected text |
| `Cmd+K` | Insert Link | Insert markdown link |
| `Cmd+Shift+K` | Code Block | Insert fenced code block |
| `Cmd+/` | Toggle Comment | Comment/uncomment line |
| `Cmd+F` | Find | Open search panel |
| `Cmd+G` | Find Next | Find next occurrence |

### View Operations

| Shortcut | Command | Description |
|----------|---------|-------------|
| `Cmd+\` | Toggle Preview | Show/hide preview pane |
| `Cmd++` | Zoom In | Increase zoom (max 200%) |
| `Cmd+-` | Zoom Out | Decrease zoom (min 50%) |
| `Cmd+0` | Reset Zoom | Reset to 100% |

---

## Core Concepts

### Commands

Every action in mdxpad is a **Command**. Commands have:
- **ID** — Unique identifier (e.g., `file.save`)
- **Name** — Display name in palette
- **Category** — Grouping (File, Edit, View, Format, Help)
- **Shortcut** — Optional keyboard binding
- **Execute** — The action to perform

### Command Registry

All commands are registered in a central **Command Registry**. This enables:
- Discovering all available commands
- Looking up commands by shortcut
- Detecting shortcut conflicts
- Tracking recently used commands

### Recent Commands

The palette shows your 5 most recently used commands at the top for quick re-access. Recent commands are persisted across sessions.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
├─────────────────────────────────────────────────────────────────┤
│  CommandPalette  │  Keyboard Handler  │  Native Menu Bar        │
│  (React + ARIA)  │  (DOM keydown)     │  (Electron Menu)        │
└────────┬─────────┴─────────┬──────────┴──────────┬──────────────┘
         │                   │                      │
         └───────────────────┼──────────────────────┘
                             ▼
         ┌───────────────────────────────────────────┐
         │          CommandRegistry (Zustand)        │
         │  • commands: Map<CommandId, Command>      │
         │  • shortcutIndex: Map<Shortcut, Id>       │
         │  • recentCommands: RecentCommandEntry[]   │
         └───────────────────────────────────────────┘
                             │ execute(id)
                             ▼
         ┌───────────────────────────────────────────┐
         │            CommandContext                  │
         │  • editor: EditorView                     │
         │  • document: { fileId, content, isDirty } │
         │  • api: MdxpadAPI (IPC)                   │
         │  • notify: (notification) => void        │
         └───────────────────────────────────────────┘
                             │
                             ▼
         ┌───────────────────────────────────────────┐
         │            Command Execution               │
         │  • File ops → IPC channels                │
         │  • Editor ops → EditorView.dispatch       │
         │  • View ops → UILayoutStore               │
         └───────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/renderer/stores/command-registry-store.ts` | Command registry singleton |
| `src/renderer/stores/ui-layout-store.ts` | UI panel visibility state |
| `src/renderer/lib/fuzzy-search.ts` | Fuzzy search algorithm |
| `src/renderer/components/CommandPalette/` | Palette component + hooks |
| `src/shared/types/commands.ts` | Command type definitions |
| `src/main/menu.ts` | Electron menu with accelerators |

---

## Extending Commands

Future features can register their own commands:

```typescript
// In your feature module
import { useCommandRegistry } from '@/stores/command-registry-store';

const registry = useCommandRegistry.getState();

registry.register({
  id: 'export.pdf' as CommandId,
  name: 'Export as PDF',
  description: 'Export document to PDF format',
  category: 'file',
  shortcut: { key: 'e', modifiers: ['Mod', 'Shift'] },
  execute: async (ctx) => {
    const result = await ctx.api.exportPdf(ctx.document.content);
    if (result.ok) {
      ctx.notify({ type: 'success', message: 'PDF exported' });
      return { ok: true };
    }
    return { ok: false, error: result.error.message };
  },
});
```

---

## Accessibility

The command palette is fully accessible:
- **ARIA combobox** pattern with listbox popup
- **Focus trap** keeps keyboard focus within modal
- **aria-activedescendant** for screen reader navigation
- **aria-live** region announces command results
- **4.5:1 contrast** for WCAG AA compliance

---

## Performance Notes

- Fuzzy search executes in <1ms for 100+ commands
- No debouncing needed for search input
- Keyboard shortcuts have <100ms response time
- Recent commands persist to localStorage
- Zoom level persists across sessions

---

## Platform Differences

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Modifier key | `Cmd` | `Ctrl` |
| Palette shortcut | `Cmd+Shift+P` | `Ctrl+Shift+P` |
| Native menu | Yes (menu bar) | Yes (window menu) |

All shortcuts use `Mod` internally, which maps to the platform-appropriate modifier.
