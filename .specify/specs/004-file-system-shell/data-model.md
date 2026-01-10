# Data Model: File System Shell

**Date**: 2026-01-09
**Feature**: 004-file-system-shell

## Overview

This document defines the data entities, their relationships, and state transitions for the File System Shell feature. Types are defined in `src/shared/types/` (READ-ONLY from Spec 001) and extended here with runtime state management.

---

## Core Entities

### FileId (from Spec 001)

Branded string type for unique file identification.

```typescript
type FileId = string & { readonly __brand: 'FileId' };
```

**Validation**: UUID v4 format
**Generation**: `createFileId()` using `crypto.randomUUID()`

---

### FileHandle (from Spec 001)

Immutable reference to a file in the system.

| Field | Type | Description |
|-------|------|-------------|
| id | FileId | Unique identifier |
| path | string \| null | Absolute file path (null for untitled) |
| name | string | Display name (filename or "Untitled") |

**Invariants**:
- `id` is unique across all handles
- `path === null` implies untitled document
- `name` is extracted from `path` or defaults to "Untitled"

---

### FileState (from Spec 001)

Runtime state of an open file.

| Field | Type | Description |
|-------|------|-------------|
| handle | FileHandle | Reference to the file |
| content | string | Current editor content |
| savedContent | string | Content at last save |
| isDirty | boolean | `content !== savedContent` |

**Computed**:
- `isDirty` is computed, not stored: `content !== savedContent`

---

### FileResult<T> (from Spec 001)

Discriminated union for operation outcomes.

```typescript
type FileResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FileError };
```

---

### FileError (from Spec 001)

Typed error codes for file operations.

| Code | When | User Message |
|------|------|--------------|
| NOT_FOUND | File doesn't exist | "The file could not be found." |
| PERMISSION_DENIED | Read/write denied | "You don't have permission to access this file." |
| CANCELLED | User cancelled dialog | (no message, silent) |
| UNKNOWN | Unexpected error | "An unexpected error occurred." |

---

## New Entities (Spec 004)

### AutoSaveEntry

Represents an auto-saved document pending recovery.

| Field | Type | Description |
|-------|------|-------------|
| fileId | FileId | Original file's ID |
| originalPath | string \| null | Original file path (null if untitled) |
| tempPath | string | Path to auto-saved temp file |
| savedAt | number | Unix timestamp of auto-save |
| displayName | string | Name to show in recovery dialog |

**Storage**: Temp files at `{tempDir}/mdxpad-autosave-{fileId}.mdx`

---

### RecentFileEntry

Entry in the recent files list.

| Field | Type | Description |
|-------|------|-------------|
| path | string | Absolute file path |
| accessedAt | number | Unix timestamp of last access |

**Storage**: electron-store, max 10 entries
**Ordering**: Most recently accessed first

---

### WatchedFile

Internal tracking for file watcher.

| Field | Type | Description |
|-------|------|-------------|
| fileId | FileId | ID of the file being watched |
| path | string | Absolute path being watched |
| watcher | FSWatcher | chokidar watcher instance |

**Lifecycle**: Created on file open, destroyed on file close

---

## State Transitions

### Document Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────┐                                                   │
│  │  START   │                                                   │
│  └────┬─────┘                                                   │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────────┐    save (path=null)    ┌──────────────┐       │
│  │   UNTITLED   │───────────────────────▶│  SAVE DIALOG │       │
│  │  (no path)   │                        └──────┬───────┘       │
│  └──────────────┘                               │               │
│       │                                         │cancel         │
│       │ edit                                    ▼               │
│       ▼                                    ┌────────┐           │
│  ┌──────────────┐                          │  back  │           │
│  │  UNTITLED    │◀─────────────────────────┤        │           │
│  │  (dirty)     │                          └────────┘           │
│  └──────────────┘                               │               │
│       │                                         │confirm        │
│       │ save                                    ▼               │
│       ▼                              ┌─────────────────┐        │
│  ┌──────────────┐                    │                 │        │
│  │    SAVED     │◀───────────────────┤   WRITE FILE   │        │
│  │  (has path)  │                    │                 │        │
│  └──────┬───────┘                    └─────────────────┘        │
│         │                                                       │
│         │ edit                                                  │
│         ▼                                                       │
│  ┌──────────────┐    save    ┌─────────────────┐               │
│  │    DIRTY     │───────────▶│   WRITE FILE    │               │
│  │  (has path)  │            │   (same path)   │               │
│  └──────────────┘            └────────┬────────┘               │
│         ▲                             │                        │
│         │                             │                        │
│         └─────────────────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Close with Unsaved Changes

```
┌───────────────┐
│  CLOSE WINDOW │
└───────┬───────┘
        │
        ▼
   ┌─────────┐     No      ┌─────────────┐
   │ isDirty?│────────────▶│ CLOSE       │
   └────┬────┘             └─────────────┘
        │ Yes
        ▼
┌───────────────────┐
│  CONFIRM DIALOG   │
│  Save/Discard/    │
│  Cancel           │
└───────┬───────────┘
        │
   ┌────┴────┬─────────┐
   │         │         │
   ▼         ▼         ▼
┌──────┐ ┌───────┐ ┌────────┐
│ Save │ │Discard│ │ Cancel │
└──┬───┘ └───┬───┘ └────┬───┘
   │         │          │
   ▼         ▼          ▼
┌───────┐ ┌──────┐ ┌─────────┐
│ WRITE │ │CLOSE │ │ STAY    │
│ FILE  │ │      │ │ OPEN    │
└───┬───┘ └──────┘ └─────────┘
    │
    ▼
┌───────┐
│ CLOSE │
└───────┘
```

### External File Change

```
┌──────────────────┐
│ CHOKIDAR CHANGE  │
└────────┬─────────┘
         │
         ▼
    ┌─────────┐
    │isDirty? │
    └────┬────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌──────────────────┐
│ No    │ │ Yes (conflict)   │
└───┬───┘ └────────┬─────────┘
    │              │
    ▼              ▼
┌───────────┐ ┌──────────────┐
│ RELOAD    │ │ CONFLICT     │
│ PROMPT    │ │ DIALOG       │
└─────┬─────┘ └──────┬───────┘
      │              │
      ▼         ┌────┴────┐
┌──────────┐    │         │
│ Reload?  │    ▼         ▼
└────┬─────┘ ┌──────┐ ┌───────┐
     │       │Reload│ │ Keep  │
┌────┴────┐  └──┬───┘ └───┬───┘
│         │     │         │
▼         ▼     ▼         ▼
Yes       No  ┌──────┐ ┌─────────┐
│         │   │UPDATE│ │KEEP     │
▼         ▼   │EDITOR│ │DIRTY    │
┌──────┐ ┌──┐ └──────┘ └─────────┘
│UPDATE│ │OK│
└──────┘ └──┘
```

---

## Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS                         │
│                                                             │
│  ┌─────────────┐      watches      ┌─────────────────┐      │
│  │ FileWatcher │──────────────────▶│ File System     │      │
│  └──────┬──────┘                   └─────────────────┘      │
│         │ notifies                         ▲                │
│         ▼                                  │ read/write     │
│  ┌─────────────┐                   ┌───────┴───────┐        │
│  │ FileService │───────────────────│ fs/promises   │        │
│  └──────┬──────┘                   └───────────────┘        │
│         │                                                   │
│         │ manages                                           │
│         ▼                                                   │
│  ┌─────────────────┐        ┌─────────────────┐             │
│  │ FileState[]     │        │ AutoSaveManager │             │
│  │ (in-memory)     │        │ (30s interval)  │             │
│  └─────────────────┘        └────────┬────────┘             │
│                                      │                      │
│                                      │ persists             │
│                                      ▼                      │
│                             ┌─────────────────┐             │
│                             │ Temp Directory  │             │
│                             │ (auto-save)     │             │
│                             └─────────────────┘             │
│                                                             │
│  ┌─────────────────┐        ┌─────────────────┐             │
│  │ RecentFiles     │───────▶│ electron-store  │             │
│  │ Service         │        │ (persistence)   │             │
│  └─────────────────┘        └─────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Validation Rules

### FileHandle
- `id`: Must be valid UUID v4
- `path`: Must be absolute path (starts with `/`) or null
- `name`: Non-empty string

### File Content
- Encoding: UTF-8 only
- Max size: 10MB (per Constitution Article V performance budget)

### Recent Files
- Max entries: 10
- Path validation: Must be absolute path
- Deduplication: Same path only stored once

### Auto-Save
- Interval: 30 seconds (per Constitution §7.3)
- Only dirty documents are auto-saved
- Temp file naming: `mdxpad-autosave-{fileId}.mdx`
