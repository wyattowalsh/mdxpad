/**
 * Cursor Overlay Component
 *
 * Renders floating labels for remote user cursors in the editor.
 * Color-coded per user with username tooltips.
 *
 * @module renderer/components/collaboration/CursorOverlay
 */

import { memo } from 'react';
import { cn } from '@shared/lib/utils';

// ============================================================================
// Types
// ============================================================================

/** Position of a remote cursor in screen coordinates */
export interface CursorPosition {
  readonly clientId: number;
  readonly username: string;
  readonly color: string;
  readonly top: number;
  readonly left: number;
  readonly height: number;
}

export interface CursorOverlayProps {
  readonly cursors: readonly CursorPosition[];
  readonly visible?: boolean;
}

// ============================================================================
// Individual Cursor
// ============================================================================

interface RemoteCursorProps {
  readonly cursor: CursorPosition;
}

function RemoteCursorComponent({ cursor }: RemoteCursorProps) {
  return (
    <div
      className="absolute pointer-events-none z-40"
      style={{
        top: cursor.top,
        left: cursor.left,
      }}
      data-testid={`remote-cursor-${cursor.clientId}`}
      aria-hidden="true"
    >
      {/* Cursor line */}
      <div
        className="w-0.5"
        style={{
          backgroundColor: cursor.color,
          height: cursor.height,
        }}
      />

      {/* Username label */}
      <div
        className={cn(
          'absolute -top-5 -left-px',
          'px-1.5 py-0.5 rounded-t-sm rounded-tr-sm',
          'text-[10px] leading-tight text-white font-medium',
          'whitespace-nowrap select-none',
          'opacity-90'
        )}
        style={{
          backgroundColor: cursor.color,
        }}
        title={cursor.username}
      >
        {cursor.username}
      </div>
    </div>
  );
}

const RemoteCursor = memo(RemoteCursorComponent);
RemoteCursor.displayName = 'RemoteCursor';

// ============================================================================
// Overlay Component
// ============================================================================

function CursorOverlayComponent({ cursors, visible = true }: CursorOverlayProps) {
  if (!visible || cursors.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      data-testid="cursor-overlay"
      aria-label={`${cursors.length} remote cursor${cursors.length !== 1 ? 's' : ''}`}
      role="presentation"
    >
      {cursors.map((cursor) => (
        <RemoteCursor key={cursor.clientId} cursor={cursor} />
      ))}
    </div>
  );
}

export const CursorOverlay = memo(CursorOverlayComponent);
CursorOverlay.displayName = 'CursorOverlay';
