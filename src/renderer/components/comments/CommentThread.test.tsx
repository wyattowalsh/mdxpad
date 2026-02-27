/**
 * Tests for CommentThread component.
 * Smoke render tests for comment thread display and interactions.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommentThreadView } from './CommentThread';
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
        content: 'This needs review',
        timestamp: Date.now(),
      },
    ],
    resolved: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('CommentThreadView', () => {
  const defaultProps = {
    currentUser: 'Bob',
    onAddMessage: vi.fn(),
    onResolve: vi.fn(),
    onUnresolve: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<CommentThreadView thread={createMockThread()} {...defaultProps} />);
    expect(screen.getByTestId('comment-thread-thread-1')).toBeDefined();
  });

  it('displays messages', () => {
    render(<CommentThreadView thread={createMockThread()} {...defaultProps} />);
    expect(screen.getByText('This needs review')).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('shows resolve button for unresolved threads', () => {
    render(<CommentThreadView thread={createMockThread()} {...defaultProps} />);
    expect(screen.getByText('Resolve')).toBeDefined();
  });

  it('shows reopen button for resolved threads', () => {
    const thread = createMockThread({ resolved: true });
    render(<CommentThreadView thread={thread} {...defaultProps} />);
    expect(screen.getByText('Reopen')).toBeDefined();
  });

  it('calls onResolve when resolve button clicked', () => {
    const onResolve = vi.fn();
    render(
      <CommentThreadView
        thread={createMockThread()}
        {...defaultProps}
        onResolve={onResolve}
      />
    );
    fireEvent.click(screen.getByText('Resolve'));
    expect(onResolve).toHaveBeenCalledWith('thread-1');
  });

  it('shows reply input for unresolved threads', () => {
    render(<CommentThreadView thread={createMockThread()} {...defaultProps} />);
    expect(screen.getByPlaceholderText('Reply as Bob...')).toBeDefined();
  });

  it('hides reply input for resolved threads', () => {
    const thread = createMockThread({ resolved: true });
    render(<CommentThreadView thread={thread} {...defaultProps} />);
    expect(screen.queryByPlaceholderText('Reply as Bob...')).toBeNull();
  });
});
