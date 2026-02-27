/**
 * Tests for CommentPanel component.
 * Smoke render tests for the comment panel sidebar.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommentPanel } from './CommentPanel';
import type { CommentThread } from '@renderer/stores/comments-store';

function createMockThread(overrides?: Partial<CommentThread>): CommentThread {
  return {
    id: 'thread-1',
    anchorFrom: 10,
    anchorTo: 50,
    messages: [
      {
        id: 'msg-1',
        author: 'Alice',
        content: 'Test comment content',
        timestamp: Date.now(),
      },
    ],
    resolved: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('CommentPanel', () => {
  const defaultProps = {
    activeThreadId: null,
    onSelectThread: vi.fn(),
    onNavigateToThread: vi.fn(),
  };

  it('renders without crashing with no threads', () => {
    render(<CommentPanel threads={[]} {...defaultProps} />);
    expect(screen.getByTestId('comment-panel')).toBeDefined();
    expect(screen.getByText('No comments yet')).toBeDefined();
  });

  it('renders thread summaries', () => {
    const threads = [
      createMockThread({ id: 'thread-1' }),
      createMockThread({ id: 'thread-2', messages: [{ id: 'm', author: 'Bob', content: 'Another', timestamp: Date.now() }] }),
    ];
    render(<CommentPanel threads={threads} {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('shows filter tabs with correct counts', () => {
    const threads = [
      createMockThread({ id: 't1', resolved: false }),
      createMockThread({ id: 't2', resolved: true }),
    ];
    render(<CommentPanel threads={threads} {...defaultProps} />);
    expect(screen.getByText('All (2)')).toBeDefined();
    expect(screen.getByText('Open (1)')).toBeDefined();
    expect(screen.getByText('Resolved (1)')).toBeDefined();
  });

  it('filters threads when tab is clicked', () => {
    const threads = [
      createMockThread({ id: 't1', resolved: false }),
      createMockThread({ id: 't2', resolved: true }),
    ];
    render(<CommentPanel threads={threads} {...defaultProps} />);

    // Click "Resolved" tab
    fireEvent.click(screen.getByText('Resolved (1)'));
    expect(screen.getByTestId('comment-panel-thread-t2')).toBeDefined();
  });

  it('calls onSelectThread when thread is clicked', () => {
    const onSelectThread = vi.fn();
    render(
      <CommentPanel
        threads={[createMockThread()]}
        {...defaultProps}
        onSelectThread={onSelectThread}
      />
    );
    fireEvent.click(screen.getByTestId('comment-panel-thread-thread-1'));
    expect(onSelectThread).toHaveBeenCalledWith('thread-1');
  });
});
