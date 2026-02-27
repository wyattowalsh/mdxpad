/**
 * Collaboration Store
 *
 * Zustand store with Immer middleware for collaboration state management.
 * Tracks room connections, peer presence, and local user info.
 *
 * @module renderer/stores/collab-store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { CollabConnectionStatus, CollabPeer } from '@shared/contracts/collab-schemas';

// ============================================================================
// Types
// ============================================================================

/** Local user info for collaboration */
export interface CollabLocalUser {
  readonly username: string;
  readonly color: string;
}

/** Collaboration state */
export interface CollabState {
  readonly roomId: string | null;
  readonly peers: readonly CollabPeer[];
  readonly connectionStatus: CollabConnectionStatus;
  readonly localUser: CollabLocalUser | null;
  readonly port: number | null;
  readonly error: string | null;
}

/** Collaboration store actions */
export interface CollabActions {
  readonly joinRoom: (roomId: string, port: number, peers: readonly CollabPeer[]) => void;
  readonly leaveRoom: () => void;
  readonly updatePeers: (peers: readonly CollabPeer[]) => void;
  readonly setConnectionStatus: (status: CollabConnectionStatus) => void;
  readonly setLocalUser: (user: CollabLocalUser) => void;
  readonly setError: (error: string | null) => void;
  readonly reset: () => void;
}

/** Combined collab store type */
export type CollabStore = CollabState & CollabActions;

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_COLLAB_STATE: CollabState = {
  roomId: null,
  peers: [],
  connectionStatus: 'disconnected',
  localUser: null,
  port: null,
  error: null,
};

// ============================================================================
// Store
// ============================================================================

/**
 * Collaboration store hook.
 * Manages collaboration state including room info, peers, and connection status.
 *
 * @example
 * ```tsx
 * const { peers, connectionStatus, joinRoom, leaveRoom } = useCollabStore();
 *
 * // Join a room
 * joinRoom('room-123', 8080, []);
 *
 * // Leave the room
 * leaveRoom();
 * ```
 */
export const useCollabStore = create<CollabStore>()(
  immer((set) => ({
    ...INITIAL_COLLAB_STATE,

    joinRoom: (roomId, port, peers) =>
      set((draft) => {
        draft.roomId = roomId;
        draft.port = port;
        draft.peers = [...peers];
        draft.connectionStatus = 'connected';
        draft.error = null;
      }),

    leaveRoom: () =>
      set((draft) => {
        draft.roomId = null;
        draft.port = null;
        draft.peers = [];
        draft.connectionStatus = 'disconnected';
        draft.error = null;
      }),

    updatePeers: (peers) =>
      set((draft) => {
        draft.peers = [...peers];
      }),

    setConnectionStatus: (status) =>
      set((draft) => {
        draft.connectionStatus = status;
      }),

    setLocalUser: (user) =>
      set((draft) => {
        draft.localUser = user;
      }),

    setError: (error) =>
      set((draft) => {
        draft.error = error;
        if (error) {
          draft.connectionStatus = 'error';
        }
      }),

    reset: () =>
      set((draft) => {
        draft.roomId = INITIAL_COLLAB_STATE.roomId;
        draft.peers = [];
        draft.connectionStatus = INITIAL_COLLAB_STATE.connectionStatus;
        draft.localUser = INITIAL_COLLAB_STATE.localUser;
        draft.port = INITIAL_COLLAB_STATE.port;
        draft.error = INITIAL_COLLAB_STATE.error;
      }),
  }))
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select the list of peers in the current room.
 */
export const selectPeers = (state: CollabStore): readonly CollabPeer[] =>
  state.peers;

/**
 * Select whether the user is connected to a collaboration room.
 */
export const selectIsConnected = (state: CollabStore): boolean =>
  state.connectionStatus === 'connected';

/**
 * Select the current room ID.
 */
export const selectRoomId = (state: CollabStore): string | null =>
  state.roomId;

/**
 * Select the connection status.
 */
export const selectConnectionStatus = (state: CollabStore): CollabConnectionStatus =>
  state.connectionStatus;

/**
 * Select the local user info.
 */
export const selectLocalUser = (state: CollabStore): CollabLocalUser | null =>
  state.localUser;

/**
 * Select the peer count.
 */
export const selectPeerCount = (state: CollabStore): number =>
  state.peers.length;

/**
 * Select the error message.
 */
export const selectCollabError = (state: CollabStore): string | null =>
  state.error;

/** Export initial state for testing */
export { INITIAL_COLLAB_STATE };
