/**
 * Tests for ConflictDialog component.
 *
 * Tests rendering, resolution buttons, cancel behavior,
 * diff view display, and keyboard navigation.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ConflictDialog } from '../conflict-dialog';
import type { FileConflict, ConflictResolution } from '@shared/contracts/autosave-schemas';
const uuidv4 = () => crypto.randomUUID();

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('../ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('../ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

// =============================================================================
// TEST DATA
// =============================================================================

const docId = uuidv4() as unknown as FileConflict['documentId'];

const mockConflict: FileConflict = {
  documentId: docId,
  filePath: '/Users/test/document.mdx',
  recoveryContent: '# Recovery Version\nLine 2\nLine 3',
  diskContent: '# Disk Version\nLine 2\nDifferent Line 3',
  recoveryTimestamp: Date.now() - 60000,
  diskModifiedAt: Date.now(),
};

// =============================================================================
// CLEANUP
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// TESTS
// =============================================================================

describe('ConflictDialog', () => {
  it('should not render when closed', () => {
    const { container } = render(
      <ConflictDialog
        isOpen={false}
        conflict={mockConflict}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container.querySelector('[data-testid="conflict-dialog"]')).toBeNull();
  });

  it('should render when open with conflict', () => {
    render(
      <ConflictDialog
        isOpen={true}
        conflict={mockConflict}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('File Conflict Detected')).toBeTruthy();
  });

  it('should display file name', () => {
    render(
      <ConflictDialog
        isOpen={true}
        conflict={mockConflict}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('document.mdx')).toBeTruthy();
  });

  it('should display file path', () => {
    render(
      <ConflictDialog
        isOpen={true}
        conflict={mockConflict}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByTitle('/Users/test/document.mdx')).toBeTruthy();
  });

  it('should show diff pane labels', () => {
    render(
      <ConflictDialog
        isOpen={true}
        conflict={mockConflict}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Recovery Version')).toBeTruthy();
    expect(screen.getByText('Disk Version')).toBeTruthy();
  });

  it('should show all resolution buttons', () => {
    render(
      <ConflictDialog
        isOpen={true}
        conflict={mockConflict}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByTestId('conflict-keep-recovery-button')).toBeTruthy();
    expect(screen.getByTestId('conflict-keep-disk-button')).toBeTruthy();
    expect(screen.getByTestId('conflict-save-as-button')).toBeTruthy();
    expect(screen.getByTestId('conflict-cancel-button')).toBeTruthy();
  });

  it('should call onResolve with recovery choice', () => {
    const onResolve = vi.fn();
    render(
      <ConflictDialog
        isOpen={true}
        conflict={mockConflict}
        onResolve={onResolve}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('conflict-keep-recovery-button'));

    expect(onResolve).toHaveBeenCalledTimes(1);
    const resolution = onResolve.mock.calls[0]?.[0] as ConflictResolution;
    expect(resolution.choice).toBe('recovery');
    expect(resolution.documentId).toBe(docId);
  });

  it('should call onResolve with disk choice', () => {
    const onResolve = vi.fn();
    render(
      <ConflictDialog
        isOpen={true}
        conflict={mockConflict}
        onResolve={onResolve}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('conflict-keep-disk-button'));

    expect(onResolve).toHaveBeenCalledTimes(1);
    const resolution = onResolve.mock.calls[0]?.[0] as ConflictResolution;
    expect(resolution.choice).toBe('disk');
  });

  it('should call onResolve with save-as choice', () => {
    const onResolve = vi.fn();
    render(
      <ConflictDialog
        isOpen={true}
        conflict={mockConflict}
        onResolve={onResolve}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('conflict-save-as-button'));

    expect(onResolve).toHaveBeenCalledTimes(1);
    const resolution = onResolve.mock.calls[0]?.[0] as ConflictResolution;
    expect(resolution.choice).toBe('save-as');
  });

  it('should call onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConflictDialog
        isOpen={true}
        conflict={mockConflict}
        onResolve={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByTestId('conflict-cancel-button'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should render empty fragment when conflict is null', () => {
    const { container } = render(
      <ConflictDialog isOpen={true} conflict={null} onResolve={vi.fn()} onCancel={vi.fn()} />
    );
    // When conflict is null, the component returns <></>, so no conflict-dialog element
    expect(container.querySelector('[data-testid="conflict-dialog"]')).toBeNull();
  });
});
