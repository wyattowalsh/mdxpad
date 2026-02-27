/**
 * Tests for ShareDialog component.
 * Smoke render tests for the share dialog.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareDialog } from './ShareDialog';
import type { ShareLink } from '@shared/contracts/share-schemas';

function createMockLink(overrides?: Partial<ShareLink>): ShareLink {
  return {
    id: 'link-1',
    token: 'abc123def456ghi789jkl012mno345pq',
    docId: 'doc-1',
    url: 'mdxpad://share/abc123',
    accessMode: 'read-only',
    createdAt: Date.now(),
    expiresAt: null,
    isActive: true,
    ...overrides,
  };
}

describe('ShareDialog', () => {
  const defaultProps = {
    onClose: vi.fn(),
    onCreateLink: vi.fn(),
    onRevokeLink: vi.fn(),
    onCopyLink: vi.fn(),
  };

  it('renders nothing when not open', () => {
    const { container } = render(
      <ShareDialog isOpen={false} activeLinks={[]} {...defaultProps} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog when open', () => {
    render(
      <ShareDialog isOpen={true} activeLinks={[]} {...defaultProps} />
    );
    expect(screen.getByTestId('share-dialog')).toBeDefined();
    expect(screen.getByText('Share Document')).toBeDefined();
  });

  it('shows active links', () => {
    const links = [createMockLink()];
    render(
      <ShareDialog isOpen={true} activeLinks={links} {...defaultProps} />
    );
    expect(screen.getByTestId('share-link-link-1')).toBeDefined();
  });

  it('calls onCreateLink when generate button clicked', () => {
    const onCreateLink = vi.fn();
    render(
      <ShareDialog
        isOpen={true}
        activeLinks={[]}
        {...defaultProps}
        onCreateLink={onCreateLink}
      />
    );
    fireEvent.click(screen.getByText('Generate Link'));
    expect(onCreateLink).toHaveBeenCalledWith('read-only');
  });

  it('shows no active links message when empty', () => {
    render(
      <ShareDialog isOpen={true} activeLinks={[]} {...defaultProps} />
    );
    expect(screen.getByText('No active share links')).toBeDefined();
  });

  it('calls onCopyLink when copy is clicked', () => {
    const onCopyLink = vi.fn();
    render(
      <ShareDialog
        isOpen={true}
        activeLinks={[createMockLink()]}
        {...defaultProps}
        onCopyLink={onCopyLink}
      />
    );
    fireEvent.click(screen.getByText('Copy'));
    expect(onCopyLink).toHaveBeenCalledWith('mdxpad://share/abc123');
  });

  it('calls onRevokeLink when revoke is clicked', () => {
    const onRevokeLink = vi.fn();
    render(
      <ShareDialog
        isOpen={true}
        activeLinks={[createMockLink()]}
        {...defaultProps}
        onRevokeLink={onRevokeLink}
      />
    );
    fireEvent.click(screen.getByText('Revoke'));
    expect(onRevokeLink).toHaveBeenCalledWith('link-1');
  });
});
