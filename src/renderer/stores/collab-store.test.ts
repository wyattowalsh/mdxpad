/**
 * Tests for Collaboration Store.
 *
 * Tests collaboration state management including room joining/leaving,
 * peer tracking, connection status, and store reset.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useCollabStore,
  INITIAL_COLLAB_STATE,
  selectPeers,
  selectIsConnected,
  selectRoomId,
  selectConnectionStatus,
  selectLocalUser,
  selectPeerCount,
  selectCollabError,
} from './collab-store';
import type { CollabPeer } from '@shared/contracts/collab-schemas';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockPeer(overrides?: Partial<CollabPeer>): CollabPeer {
  return {
    clientId: 1,
    username: 'Alice',
    color: '#6366f1',
    lastActive: Date.now(),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useCollabStore', () => {
  beforeEach(() => {
    useCollabStore.getState().reset();
  });

  describe('initial state', () => {
    it('should start with disconnected status', () => {
      const state = useCollabStore.getState();
      expect(state.connectionStatus).toBe('disconnected');
    });

    it('should start with no room', () => {
      const state = useCollabStore.getState();
      expect(state.roomId).toBeNull();
    });

    it('should start with empty peers', () => {
      const state = useCollabStore.getState();
      expect(state.peers).toHaveLength(0);
    });

    it('should start with no local user', () => {
      const state = useCollabStore.getState();
      expect(state.localUser).toBeNull();
    });

    it('should start with no error', () => {
      const state = useCollabStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('joinRoom', () => {
    it('should set room info and connected status', () => {
      const peers = [createMockPeer()];
      useCollabStore.getState().joinRoom('room-1', 8080, peers);
      const state = useCollabStore.getState();

      expect(state.roomId).toBe('room-1');
      expect(state.port).toBe(8080);
      expect(state.connectionStatus).toBe('connected');
      expect(state.peers).toHaveLength(1);
    });

    it('should clear any existing error', () => {
      useCollabStore.getState().setError('previous error');
      useCollabStore.getState().joinRoom('room-1', 8080, []);
      expect(useCollabStore.getState().error).toBeNull();
    });

    it('should handle multiple peers', () => {
      const peers = [
        createMockPeer({ clientId: 1, username: 'Alice' }),
        createMockPeer({ clientId: 2, username: 'Bob' }),
        createMockPeer({ clientId: 3, username: 'Charlie' }),
      ];
      useCollabStore.getState().joinRoom('room-1', 8080, peers);
      expect(useCollabStore.getState().peers).toHaveLength(3);
    });
  });

  describe('leaveRoom', () => {
    it('should reset to disconnected state', () => {
      useCollabStore.getState().joinRoom('room-1', 8080, [createMockPeer()]);
      useCollabStore.getState().leaveRoom();
      const state = useCollabStore.getState();

      expect(state.roomId).toBeNull();
      expect(state.port).toBeNull();
      expect(state.peers).toHaveLength(0);
      expect(state.connectionStatus).toBe('disconnected');
    });
  });

  describe('updatePeers', () => {
    it('should update the peer list', () => {
      useCollabStore.getState().joinRoom('room-1', 8080, []);
      const newPeers = [
        createMockPeer({ clientId: 5, username: 'Dave' }),
      ];
      useCollabStore.getState().updatePeers(newPeers);
      expect(useCollabStore.getState().peers).toHaveLength(1);
      expect(useCollabStore.getState().peers[0]?.username).toBe('Dave');
    });

    it('should replace all peers', () => {
      useCollabStore.getState().joinRoom('room-1', 8080, [createMockPeer()]);
      useCollabStore.getState().updatePeers([]);
      expect(useCollabStore.getState().peers).toHaveLength(0);
    });
  });

  describe('setConnectionStatus', () => {
    it('should update connection status', () => {
      useCollabStore.getState().setConnectionStatus('connecting');
      expect(useCollabStore.getState().connectionStatus).toBe('connecting');
    });
  });

  describe('setLocalUser', () => {
    it('should set local user info', () => {
      useCollabStore.getState().setLocalUser({ username: 'Me', color: '#ff0000' });
      const state = useCollabStore.getState();
      expect(state.localUser?.username).toBe('Me');
      expect(state.localUser?.color).toBe('#ff0000');
    });
  });

  describe('setError', () => {
    it('should set error and change status to error', () => {
      useCollabStore.getState().setError('Connection failed');
      const state = useCollabStore.getState();
      expect(state.error).toBe('Connection failed');
      expect(state.connectionStatus).toBe('error');
    });

    it('should clear error when set to null', () => {
      useCollabStore.getState().setError('some error');
      useCollabStore.getState().setError(null);
      expect(useCollabStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should return to initial state', () => {
      useCollabStore.getState().joinRoom('room-1', 8080, [createMockPeer()]);
      useCollabStore.getState().setLocalUser({ username: 'Me', color: '#ff0000' });
      useCollabStore.getState().reset();
      const state = useCollabStore.getState();

      expect(state.roomId).toBe(INITIAL_COLLAB_STATE.roomId);
      expect(state.peers).toHaveLength(0);
      expect(state.connectionStatus).toBe(INITIAL_COLLAB_STATE.connectionStatus);
      expect(state.localUser).toBe(INITIAL_COLLAB_STATE.localUser);
    });
  });
});

describe('collab selectors', () => {
  beforeEach(() => {
    useCollabStore.getState().reset();
  });

  it('selectPeers returns peers', () => {
    expect(selectPeers(useCollabStore.getState())).toHaveLength(0);
    useCollabStore.getState().joinRoom('r', 80, [createMockPeer()]);
    expect(selectPeers(useCollabStore.getState())).toHaveLength(1);
  });

  it('selectIsConnected returns true when connected', () => {
    expect(selectIsConnected(useCollabStore.getState())).toBe(false);
    useCollabStore.getState().joinRoom('r', 80, []);
    expect(selectIsConnected(useCollabStore.getState())).toBe(true);
  });

  it('selectRoomId returns room id', () => {
    expect(selectRoomId(useCollabStore.getState())).toBeNull();
    useCollabStore.getState().joinRoom('room-x', 80, []);
    expect(selectRoomId(useCollabStore.getState())).toBe('room-x');
  });

  it('selectConnectionStatus returns status', () => {
    expect(selectConnectionStatus(useCollabStore.getState())).toBe('disconnected');
  });

  it('selectLocalUser returns local user', () => {
    expect(selectLocalUser(useCollabStore.getState())).toBeNull();
    useCollabStore.getState().setLocalUser({ username: 'Test', color: '#000' });
    expect(selectLocalUser(useCollabStore.getState())?.username).toBe('Test');
  });

  it('selectPeerCount returns count', () => {
    expect(selectPeerCount(useCollabStore.getState())).toBe(0);
    useCollabStore.getState().joinRoom('r', 80, [createMockPeer(), createMockPeer({ clientId: 2 })]);
    expect(selectPeerCount(useCollabStore.getState())).toBe(2);
  });

  it('selectCollabError returns error', () => {
    expect(selectCollabError(useCollabStore.getState())).toBeNull();
    useCollabStore.getState().setError('err');
    expect(selectCollabError(useCollabStore.getState())).toBe('err');
  });
});
