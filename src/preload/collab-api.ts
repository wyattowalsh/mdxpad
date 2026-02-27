/**
 * Collaboration Preload API — Exposes collaboration operations to renderer.
 * Uses ipcRenderer.invoke for request-response and ipcRenderer.on for events.
 *
 * @security Uses invoke/handle pattern for all operations.
 * @security All payloads validated with zod on both ends per Constitution III.3.
 * @module preload/collab-api
 */

import { ipcRenderer } from 'electron';
import { z } from 'zod';
import {
  CollabChannels,
  CollabJoinRequestSchema,
  CollabJoinResponseSchema,
  CollabLeaveRequestSchema,
  CollabLeaveResponseSchema,
  CollabStatusRequestSchema,
  CollabStatusResponseSchema,
  CollabPeerUpdateEventSchema,
  type CollabJoinRequest,
  type CollabJoinResponse,
  type CollabLeaveRequest,
  type CollabLeaveResponse,
  type CollabStatusRequest,
  type CollabStatusResponse,
  type CollabPeerUpdateEvent,
} from '@shared/contracts/collab-schemas';

// ============================================================================
// Validated Invoke Helper
// ============================================================================

/**
 * Performs a validated collab IPC invoke with schema validation.
 */
async function validatedCollabInvoke<TRes>(
  channel: string,
  responseSchema: z.ZodType<TRes>,
  args?: unknown
): Promise<TRes> {
  const response: unknown = await ipcRenderer.invoke(channel, args);
  const parsed = responseSchema.safeParse(response);
  if (!parsed.success) {
    throw new Error(`Collab response validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}

// ============================================================================
// Collab API Interface
// ============================================================================

/**
 * Collaboration API exposed to renderer via contextBridge.
 */
export interface CollabApi {
  /**
   * Join a collaboration room for a document.
   * @param request - Join room configuration
   * @returns Room ID, port, and current peers
   */
  join(request: CollabJoinRequest): Promise<CollabJoinResponse>;

  /**
   * Leave a collaboration room.
   * @param request - Room to leave
   * @returns Success indicator
   */
  leave(request: CollabLeaveRequest): Promise<CollabLeaveResponse>;

  /**
   * Get the current status of a collaboration room.
   * @param request - Room to query
   * @returns Connection status and peer list
   */
  getStatus(request: CollabStatusRequest): Promise<CollabStatusResponse>;

  /**
   * Subscribe to peer update events.
   * @param callback - Called when peer list changes
   * @returns Unsubscribe function
   */
  onUpdate(callback: (event: CollabPeerUpdateEvent) => void): () => void;

  /**
   * Subscribe to connection status change events.
   * @param callback - Called when connection status changes
   * @returns Unsubscribe function
   */
  onConnectionChange(callback: (status: string) => void): () => void;
}

// ============================================================================
// Event Listener Registries
// ============================================================================

const peerUpdateListeners = new Set<(event: CollabPeerUpdateEvent) => void>();
const connectionChangeListeners = new Set<(status: string) => void>();

// Set up IPC event listeners (once, shared across all subscriptions)
ipcRenderer.on(CollabChannels.PEER_UPDATE, (_event, data: unknown) => {
  const validated = CollabPeerUpdateEventSchema.safeParse(data);
  if (validated.success) {
    for (const listener of peerUpdateListeners) {
      listener(validated.data);
    }
  } else {
    console.error('[CollabAPI] Invalid peer update data:', validated.error.message);
  }
});

ipcRenderer.on(CollabChannels.CONNECTION_CHANGE, (_event, data: unknown) => {
  if (typeof data === 'string') {
    for (const listener of connectionChangeListeners) {
      listener(data);
    }
  }
});

// ============================================================================
// Collab API Implementation
// ============================================================================

/**
 * Collaboration API implementation for preload exposure.
 */
export const collabApi: CollabApi = {
  join: async (request) => {
    const reqParsed = CollabJoinRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      throw new Error(`Collab join request validation failed: ${reqParsed.error.message}`);
    }

    return validatedCollabInvoke(
      CollabChannels.JOIN,
      CollabJoinResponseSchema,
      reqParsed.data
    );
  },

  leave: async (request) => {
    const reqParsed = CollabLeaveRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      throw new Error(`Collab leave request validation failed: ${reqParsed.error.message}`);
    }

    return validatedCollabInvoke(
      CollabChannels.LEAVE,
      CollabLeaveResponseSchema,
      reqParsed.data
    );
  },

  getStatus: async (request) => {
    const reqParsed = CollabStatusRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      throw new Error(`Collab status request validation failed: ${reqParsed.error.message}`);
    }

    return validatedCollabInvoke(
      CollabChannels.STATUS,
      CollabStatusResponseSchema,
      reqParsed.data
    );
  },

  onUpdate: (callback) => {
    peerUpdateListeners.add(callback);
    return () => {
      peerUpdateListeners.delete(callback);
    };
  },

  onConnectionChange: (callback) => {
    connectionChangeListeners.add(callback);
    return () => {
      connectionChangeListeners.delete(callback);
    };
  },
};
