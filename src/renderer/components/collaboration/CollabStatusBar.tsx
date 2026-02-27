/**
 * Collaboration Status Bar Widget
 *
 * Shows connection status with a color-coded dot indicator,
 * peer count, and a popover with the peer list.
 *
 * @module renderer/components/collaboration/CollabStatusBar
 */

import { memo, useState, useCallback } from 'react';
import { cn } from '@shared/lib/utils';
import type { CollabConnectionStatus, CollabPeer } from '@shared/contracts/collab-schemas';

// ============================================================================
// Types
// ============================================================================

export interface CollabStatusBarProps {
  readonly connectionStatus: CollabConnectionStatus;
  readonly peers: readonly CollabPeer[];
  readonly roomId: string | null;
  readonly onDisconnect?: (() => void) | undefined;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_COLORS: Record<CollabConnectionStatus, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500 animate-pulse',
  disconnected: 'bg-gray-400',
  error: 'bg-red-500',
};

const STATUS_LABELS: Record<CollabConnectionStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting...',
  disconnected: 'Disconnected',
  error: 'Connection Error',
};

// ============================================================================
// Popover Sub-component
// ============================================================================

interface PeerPopoverProps {
  readonly roomId: string | null;
  readonly peers: readonly CollabPeer[];
  readonly connectionStatus: CollabConnectionStatus;
  readonly onDisconnect?: (() => void) | undefined;
}

function PeerPopoverComponent({ roomId, peers, connectionStatus, onDisconnect }: PeerPopoverProps) {
  return (
    <div
      className={cn(
        'absolute bottom-full right-0 mb-1',
        'bg-popover border border-border rounded-md shadow-md',
        'min-w-48 max-w-64 p-2 z-50'
      )}
      role="dialog"
      aria-label="Peer list"
      data-testid="collab-peer-popover"
    >
      <div className="text-xs font-medium text-muted-foreground mb-1.5">
        {roomId ? `Room: ${roomId}` : 'No Room'}
      </div>
      {peers.length === 0 ? (
        <div className="text-xs text-muted-foreground py-1">No peers connected</div>
      ) : (
        <ul className="space-y-1" role="list">
          {peers.map((peer) => (
            <li key={peer.clientId} className="flex items-center gap-2 text-xs py-0.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: peer.color }}
                aria-hidden="true"
              />
              <span className="truncate">{peer.username}</span>
            </li>
          ))}
        </ul>
      )}
      {connectionStatus === 'connected' && onDisconnect && (
        <button
          type="button"
          className={cn(
            'mt-2 w-full text-xs text-center py-1 rounded',
            'bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors'
          )}
          onClick={onDisconnect}
        >
          Disconnect
        </button>
      )}
    </div>
  );
}

const PeerPopover = memo(PeerPopoverComponent);
PeerPopover.displayName = 'PeerPopover';

// ============================================================================
// Main Component
// ============================================================================

function CollabStatusBarComponent({
  connectionStatus,
  peers,
  roomId,
  onDisconnect,
}: CollabStatusBarProps) {
  const [showPopover, setShowPopover] = useState(false);

  const togglePopover = useCallback(() => {
    setShowPopover((prev) => !prev);
  }, []);

  const handleDisconnect = useCallback(() => {
    setShowPopover(false);
    onDisconnect?.();
  }, [onDisconnect]);

  const peerLabel =
    peers.length > 0
      ? `${peers.length} peer${peers.length !== 1 ? 's' : ''}`
      : STATUS_LABELS[connectionStatus];

  return (
    <div className="relative inline-flex items-center" data-testid="collab-status-bar">
      <button
        type="button"
        className={cn(
          'flex items-center gap-1.5 px-2 py-0.5 rounded text-xs',
          'hover:bg-muted/80 transition-colors focus:outline-none focus:ring-1 focus:ring-ring'
        )}
        onClick={togglePopover}
        aria-label={`Collaboration: ${STATUS_LABELS[connectionStatus]}, ${peers.length} peers`}
        aria-expanded={showPopover}
      >
        <span
          className={cn('inline-block w-2 h-2 rounded-full', STATUS_COLORS[connectionStatus])}
          aria-hidden="true"
        />
        <span className="text-muted-foreground">{peerLabel}</span>
      </button>
      {showPopover && (
        <PeerPopover
          roomId={roomId}
          peers={peers}
          connectionStatus={connectionStatus}
          onDisconnect={handleDisconnect}
        />
      )}
    </div>
  );
}

export const CollabStatusBar = memo(CollabStatusBarComponent);
CollabStatusBar.displayName = 'CollabStatusBar';
