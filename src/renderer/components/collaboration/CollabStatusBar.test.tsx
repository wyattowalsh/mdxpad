/**
 * Tests for CollabStatusBar component.
 * Smoke render tests verifying rendering in various states.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollabStatusBar } from './CollabStatusBar';
import type { CollabPeer } from '@shared/contracts/collab-schemas';

function createMockPeer(overrides?: Partial<CollabPeer>): CollabPeer {
  return {
    clientId: 1,
    username: 'Alice',
    color: '#6366f1',
    lastActive: Date.now(),
    ...overrides,
  };
}

describe('CollabStatusBar', () => {
  it('renders without crashing when disconnected', () => {
    render(
      <CollabStatusBar
        connectionStatus="disconnected"
        peers={[]}
        roomId={null}
      />
    );
    expect(screen.getByTestId('collab-status-bar')).toBeDefined();
  });

  it('renders connected state with peers', () => {
    const peers = [
      createMockPeer({ clientId: 1, username: 'Alice' }),
      createMockPeer({ clientId: 2, username: 'Bob' }),
    ];
    render(
      <CollabStatusBar
        connectionStatus="connected"
        peers={peers}
        roomId="room-1"
      />
    );
    expect(screen.getByText('2 peers')).toBeDefined();
  });

  it('renders singular peer text for 1 peer', () => {
    render(
      <CollabStatusBar
        connectionStatus="connected"
        peers={[createMockPeer()]}
        roomId="room-1"
      />
    );
    expect(screen.getByText('1 peer')).toBeDefined();
  });

  it('shows popover when clicked', () => {
    render(
      <CollabStatusBar
        connectionStatus="connected"
        peers={[createMockPeer({ username: 'TestUser' })]}
        roomId="room-1"
      />
    );
    const button = screen.getByRole('button', { expanded: false });
    fireEvent.click(button);
    expect(screen.getByTestId('collab-peer-popover')).toBeDefined();
    expect(screen.getByText('TestUser')).toBeDefined();
  });

  it('calls onDisconnect when disconnect button is clicked', () => {
    const onDisconnect = vi.fn();
    render(
      <CollabStatusBar
        connectionStatus="connected"
        peers={[]}
        roomId="room-1"
        onDisconnect={onDisconnect}
      />
    );
    // Open popover
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    // Click disconnect
    fireEvent.click(screen.getByText('Disconnect'));
    expect(onDisconnect).toHaveBeenCalledOnce();
  });
});
