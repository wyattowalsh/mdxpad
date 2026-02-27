/**
 * Collaboration IPC handlers.
 * Handles all collaboration IPC communication between main and renderer.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * @module main/ipc/collab-handlers
 */

import type { IpcMain, BrowserWindow } from 'electron';
import {
  CollabChannels,
  CollabJoinRequestSchema,
  CollabLeaveRequestSchema,
  CollabStatusRequestSchema,
  type CollabJoinResponse,
  type CollabLeaveResponse,
  type CollabStatusResponse,
  type CollabPeer,
} from '@shared/contracts/collab-schemas';
import { createValidatedHandler } from '@shared/contracts/file-schemas';
import type { CollaborationServer } from '@main/services/collab-server';
import { AwarenessManager } from '@main/services/collab-awareness';

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Create the join room handler.
 */
function createJoinHandler(
  server: CollaborationServer,
  awareness: AwarenessManager
) {
  return createValidatedHandler(
    CollabJoinRequestSchema,
    async (args): Promise<CollabJoinResponse> => {
      const { docId, username, color } = args;
      const userColor = color ?? awareness.getNextColor();

      // Ensure server is running
      let port = server.getPort();
      if (!server.isRunning()) {
        port = await server.start(0);
      }

      // Set local awareness state
      awareness.setLocalState({
        username,
        color: userColor,
        isActive: true,
      });

      // Get current room info
      const room = server.getRoom(docId);
      const peers: CollabPeer[] = room
        ? room.clients.map((c) => ({
            clientId: c.clientId,
            username: c.username,
            color: c.color,
            lastActive: c.joinedAt,
          }))
        : [];

      return {
        success: true,
        roomId: `room-${docId}`,
        port,
        peers,
      };
    }
  );
}

/**
 * Create the leave room handler.
 */
function createLeaveHandler(awareness: AwarenessManager) {
  return createValidatedHandler(
    CollabLeaveRequestSchema,
    (_args): Promise<CollabLeaveResponse> => {
      awareness.setLocalState({
        username: '',
        color: '#000000',
        isActive: false,
      });

      return Promise.resolve({ success: true as const });
    }
  );
}

/**
 * Create the status handler.
 */
function createStatusHandler(
  server: CollaborationServer,
  awareness: AwarenessManager
) {
  return createValidatedHandler(
    CollabStatusRequestSchema,
    (args): Promise<CollabStatusResponse> => {
      const { roomId } = args;
      const docId = roomId.replace(/^room-/, '');
      const room = server.getRoom(docId);
      const port = server.getPort();

      if (!room) {
        return Promise.resolve({
          status: 'disconnected' as const,
          roomId: null,
          peers: [],
          port: port > 0 ? port : null,
        });
      }

      const remotePeers = awareness.getStates();
      const peers: CollabPeer[] = remotePeers.map((s) => ({
        clientId: s.clientId,
        username: s.username,
        color: s.color,
        cursorLine: s.cursorLine,
        cursorColumn: s.cursorColumn,
        selectionFrom: s.selectionFrom,
        selectionTo: s.selectionTo,
        lastActive: s.lastUpdated,
      }));

      return Promise.resolve({
        status: 'connected' as const,
        roomId,
        peers,
        port: port > 0 ? port : null,
      });
    }
  );
}

// ============================================================================
// Registration
// ============================================================================

/**
 * Registers all collaboration IPC handlers.
 * Called during app initialization when collaboration feature is enabled.
 *
 * @param ipcMainInstance - The Electron IpcMain instance
 * @param server - The collaboration server instance
 * @param _window - The main BrowserWindow (for sending events)
 */
export function registerCollabHandlers(
  ipcMainInstance: IpcMain,
  server: CollaborationServer,
  _window: BrowserWindow
): void {
  const awareness = new AwarenessManager();
  awareness.start();

  const handleJoin = createJoinHandler(server, awareness);
  const handleLeave = createLeaveHandler(awareness);
  const handleStatus = createStatusHandler(server, awareness);

  ipcMainInstance.handle(CollabChannels.JOIN, (_event, args) =>
    handleJoin(args)
  );

  ipcMainInstance.handle(CollabChannels.LEAVE, (_event, args) =>
    handleLeave(args)
  );

  ipcMainInstance.handle(CollabChannels.STATUS, (_event, args) =>
    handleStatus(args)
  );

  // Forward awareness updates to renderer
  awareness.onUpdate((states) => {
    if (_window.isDestroyed()) {
      return;
    }

    _window.webContents.send(CollabChannels.PEER_UPDATE, {
      roomId: 'active',
      peers: states.map((s) => ({
        clientId: s.clientId,
        username: s.username,
        color: s.color,
        cursorLine: s.cursorLine,
        cursorColumn: s.cursorColumn,
        selectionFrom: s.selectionFrom,
        selectionTo: s.selectionTo,
        lastActive: s.lastUpdated,
      })),
    });
  });

  console.log('[CollabHandlers] All collaboration handlers registered');
}
