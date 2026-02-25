/**
 * Tests for RecoveryDialog component.
 *
 * Tests rendering, entry selection, restore/discard/dismiss actions,
 * and content preview.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { RecoveryDialog } from '../recovery-dialog';
import type {
  RecoveryDialogEntry,
  RecoveryDecision,
  DocumentId,
} from '@shared/contracts/autosave-schemas';
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

vi.mock('../ui/resizable', () => ({
  ResizablePanelGroup: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div data-testid="resize-handle" />,
}));

// =============================================================================
// TEST DATA
// =============================================================================

const docId1 = uuidv4() as unknown as DocumentId;
const docId2 = uuidv4() as unknown as DocumentId;

const mockEntries: RecoveryDialogEntry[] = [
  {
    documentId: docId1,
    fileName: 'document1.mdx',
    filePath: '/Users/test/document1.mdx',
    savedAt: Date.now() - 120000,
    contentPreview: '# Document 1\nSome preview text...',
    isValid: true,
    hasConflict: false,
  },
  {
    documentId: docId2,
    fileName: 'document2.mdx',
    filePath: '/Users/test/document2.mdx',
    savedAt: Date.now() - 60000,
    contentPreview: '# Document 2\nAnother preview...',
    isValid: true,
    hasConflict: true,
  },
];

// =============================================================================
// CLEANUP
// =============================================================================

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'mdxpad');
});

// =============================================================================
// TESTS
// =============================================================================

describe('RecoveryDialog', () => {
  it('should not render when closed', () => {
    const { container } = render(
      <RecoveryDialog isOpen={false} entries={mockEntries} onDecision={vi.fn()} />
    );
    expect(container.querySelector('[data-testid="recovery-dialog"]')).toBeNull();
  });

  it('should render when open with entries', () => {
    render(<RecoveryDialog isOpen={true} entries={mockEntries} onDecision={vi.fn()} />);
    expect(screen.getByText('Recover Unsaved Work')).toBeTruthy();
  });

  it('should show correct count in description', () => {
    render(<RecoveryDialog isOpen={true} entries={mockEntries} onDecision={vi.fn()} />);
    expect(screen.getByText(/Found 2 documents/)).toBeTruthy();
  });

  it('should show singular for one entry', () => {
    render(<RecoveryDialog isOpen={true} entries={[mockEntries[0]!]} onDecision={vi.fn()} />);
    expect(screen.getByText(/Found 1 document/)).toBeTruthy();
  });

  it('should display entry file names', () => {
    render(<RecoveryDialog isOpen={true} entries={mockEntries} onDecision={vi.fn()} />);
    // File name may appear in both list and preview panel
    expect(screen.getAllByText('document1.mdx').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('document2.mdx').length).toBeGreaterThanOrEqual(1);
  });

  it('should show conflict badge for conflicting entries', () => {
    render(<RecoveryDialog isOpen={true} entries={mockEntries} onDecision={vi.fn()} />);
    expect(screen.getByText('Conflict')).toBeTruthy();
  });

  it('should show discard and restore buttons', () => {
    render(<RecoveryDialog isOpen={true} entries={mockEntries} onDecision={vi.fn()} />);
    expect(screen.getByTestId('recovery-discard-button')).toBeTruthy();
    expect(screen.getByTestId('recovery-restore-button')).toBeTruthy();
  });

  it('should call onDecision with decline when discard clicked', () => {
    const onDecision = vi.fn();
    render(<RecoveryDialog isOpen={true} entries={mockEntries} onDecision={onDecision} />);

    fireEvent.click(screen.getByTestId('recovery-discard-button'));

    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith({ action: 'decline' });
  });

  it('should call onDecision with accept and one selected ID when restore clicked', () => {
    const onDecision = vi.fn();
    render(<RecoveryDialog isOpen={true} entries={mockEntries} onDecision={onDecision} />);

    // Single-document mode preselects one valid entry
    fireEvent.click(screen.getByTestId('recovery-restore-button'));

    expect(onDecision).toHaveBeenCalledTimes(1);
    const decision = onDecision.mock.calls[0]![0] as RecoveryDecision;
    expect(decision.action).toBe('accept');
    if (decision.action === 'accept') {
      expect(decision.selectedIds).toHaveLength(1);
    }
  });

  it('should show selection count in footer', () => {
    render(<RecoveryDialog isOpen={true} entries={mockEntries} onDecision={vi.fn()} />);
    expect(screen.getByText('1 of 2 selected')).toBeTruthy();
  });

  it('should keep only one selection when choosing another entry', () => {
    const onDecision = vi.fn();
    render(<RecoveryDialog isOpen={true} entries={mockEntries} onDecision={onDecision} />);

    fireEvent.click(screen.getByTestId(`recovery-entry-${docId2}`));
    fireEvent.click(screen.getByTestId('recovery-restore-button'));

    const decision = onDecision.mock.calls[0]![0] as RecoveryDecision;
    expect(decision.action).toBe('accept');
    if (decision.action === 'accept') {
      expect(decision.selectedIds).toEqual([docId2]);
    }
  });

  it('should show recovery list and preview panel', () => {
    render(<RecoveryDialog isOpen={true} entries={mockEntries} onDecision={vi.fn()} />);
    expect(screen.getByTestId('recovery-list')).toBeTruthy();
    expect(screen.getByTestId('recovery-preview')).toBeTruthy();
  });

  it('should fetch preview content via preload recovery API', async () => {
    const recoveryPreview = vi.fn().mockResolvedValue({
      ok: true,
      content: '# Full recovered content',
      conflict: null,
    });

    (window as unknown as Record<string, unknown>).mdxpad = {
      recoveryPreview,
    };

    render(<RecoveryDialog isOpen={true} entries={mockEntries} onDecision={vi.fn()} />);

    await waitFor(
      () => {
        expect(recoveryPreview).toHaveBeenCalledWith({ documentId: docId1 });
      },
      { timeout: 2000 }
    );

    await waitFor(
      () => {
        expect(screen.getByText('# Full recovered content')).toBeTruthy();
      },
      { timeout: 2000 }
    );
  });

  it('should show preview error message from preload API response', async () => {
    const recoveryPreview = vi.fn().mockResolvedValue({
      ok: false,
      error: 'NOT_FOUND',
    });

    (window as unknown as Record<string, unknown>).mdxpad = {
      recoveryPreview,
    };

    render(<RecoveryDialog isOpen={true} entries={mockEntries} onDecision={vi.fn()} />);

    await waitFor(
      () => {
        expect(screen.getByText('Recovery file not found')).toBeTruthy();
      },
      { timeout: 2000 }
    );
  });
});
