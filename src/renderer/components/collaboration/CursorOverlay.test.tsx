/**
 * Tests for CursorOverlay component.
 * Smoke render tests verifying rendering of remote cursors.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CursorOverlay, type CursorPosition } from './CursorOverlay';

function createMockCursor(overrides?: Partial<CursorPosition>): CursorPosition {
  return {
    clientId: 1,
    username: 'Alice',
    color: '#6366f1',
    top: 100,
    left: 50,
    height: 20,
    ...overrides,
  };
}

describe('CursorOverlay', () => {
  it('renders nothing when no cursors', () => {
    const { container } = render(<CursorOverlay cursors={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when not visible', () => {
    const { container } = render(
      <CursorOverlay cursors={[createMockCursor()]} visible={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders cursor overlay container', () => {
    render(<CursorOverlay cursors={[createMockCursor()]} />);
    expect(screen.getByTestId('cursor-overlay')).toBeDefined();
  });

  it('renders individual remote cursors', () => {
    const cursors = [
      createMockCursor({ clientId: 1, username: 'Alice' }),
      createMockCursor({ clientId: 2, username: 'Bob', color: '#ec4899' }),
    ];
    render(<CursorOverlay cursors={cursors} />);
    expect(screen.getByTestId('remote-cursor-1')).toBeDefined();
    expect(screen.getByTestId('remote-cursor-2')).toBeDefined();
  });

  it('displays username labels', () => {
    render(
      <CursorOverlay
        cursors={[createMockCursor({ username: 'TestUser' })]}
      />
    );
    expect(screen.getByText('TestUser')).toBeDefined();
  });
});
