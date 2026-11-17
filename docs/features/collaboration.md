# Real-Time Collaboration

MDXPad supports real-time collaborative editing using Yjs CRDTs and a WebSocket server running in the Electron main process.

## Architecture

```
Renderer A                Main Process              Renderer B
┌──────────┐             ┌───────────────┐         ┌──────────┐
│ CollabStore│◄──IPC────►│ CollabServer   │◄──IPC──►│CollabStore│
│ YjsBinding │           │ (WebSocket)    │         │YjsBinding │
│ CursorOverlay│         │ Room Manager   │         │CursorOverlay│
└──────────┘             └───────────────┘         └──────────┘
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `CollaborationServer` | `src/main/services/collab-server.ts` | Yjs WebSocket server in main process |
| `CollaborationService` | `src/main/services/collaboration-service.ts` | Comment threads and suggestions persistence |
| `collab-awareness.ts` | `src/main/services/collab-awareness.ts` | Peer presence/awareness protocol |
| `collab-handlers.ts` | `src/main/ipc/collab-handlers.ts` | IPC handlers for collab operations |
| `useCollabStore` | `src/renderer/stores/collab-store.ts` | Zustand store for collab state |
| `yjs-binding.ts` | `src/renderer/lib/editor/yjs-binding.ts` | Binds Yjs document to CodeMirror |
| `CollabStatusBar` | `src/renderer/components/collaboration/CollabStatusBar.tsx` | Connection status indicator |
| `CursorOverlay` | `src/renderer/components/collaboration/CursorOverlay.tsx` | Remote cursor rendering |

### Dependencies

- **yjs** `^13.6.29` -- CRDT document model
- **y-websocket** `^3.0.0` -- WebSocket provider
- **y-indexeddb** `^9.0.12` -- Offline persistence
- **lib0** `^0.2.117` -- Yjs utility library

## WebSocket Server

The `CollaborationServer` runs inside Electron's main process. Each document gets a room identified by `docId`.

### Room Management

- Maximum 50 rooms (configurable via `maxRooms`)
- Maximum 20 clients per room (configurable via `maxClientsPerRoom`)
- Document updates are buffered (up to 1000 per room) for late joiners
- Empty rooms are automatically cleaned up

### Connection Protocol

Clients connect via WebSocket with query parameters:

```
ws://localhost:{port}?docId={docId}&username={username}&color={color}
```

### IPC Schemas

Collaboration IPC contracts are defined in `src/shared/contracts/collab-schemas.ts`:
- Connection status: `connected`, `connecting`, `disconnected`, `error`
- Peer info: `clientId`, `username`, `color`

## Comments and Suggestions

The `CollaborationService` manages threaded comments and change suggestions:

### Comment Threads

- Anchored to document positions
- Threaded replies
- Open/resolved state tracking
- Persisted as JSON files in `~/.mdxpad/collaboration/`

### Suggestions

- Inline change proposals with diff patches
- Acceptance records `accepted` or `outdated` and does not edit the document
- Reject is not available
- Checksum-based staleness detection (marks suggestions as `outdated` if document changed)

### UI Components

- `CommentPanel` (`src/renderer/components/comments/CommentPanel.tsx`) -- Side panel listing threads
- `CommentThread` (`src/renderer/components/comments/CommentThread.tsx`) -- Individual thread view
- `CommentGutter` (`src/renderer/components/comments/CommentGutter.tsx`) -- Gutter markers in editor

## Collab Store

The `useCollabStore` (Zustand + Immer) tracks:

- `roomId` -- Current room identifier
- `peers` -- Connected collaborators
- `connectionStatus` -- Connection state
- `localUser` -- Username and cursor color
- `port` -- WebSocket server port

## Preload API

The renderer accesses collaboration features via `window.mdxpad.collaboration`:

```typescript
// Join/leave rooms
collaboration.join({ docId, username, color })
collaboration.leave({ docId })

// Comment operations
collaboration.addComment({ documentId, author, message, anchor })
collaboration.resolveThread({ documentId, threadId, resolved })
collaboration.addSuggestion({ documentId, anchor, patch, rationale, author })
```
