/**
 * StatusBar Component Tests
 *
 * Comprehensive tests for StatusBar and its subcomponents:
 * - StatusBar renders all subcomponents
 * - FileInfo displays filename and dirty/orphan indicators
 * - CursorPosition displays line and column
 * - ErrorCount shows error count and popover functionality
 *
 * @module renderer/components/shell/StatusBar/StatusBar.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { StatusBar } from './StatusBar';
import { FileInfo } from './FileInfo';
import { CursorPosition } from './CursorPosition';
import { ErrorCount } from './ErrorCount';
import type { CompilationError } from './types';

// =============================================================================
// TEST DATA
// =============================================================================

const mockErrors: CompilationError[] = [
  { message: 'Unexpected token', line: 5, column: 10 },
  { message: 'Missing closing bracket', line: 12, column: 1 },
  { message: 'Invalid JSX syntax', line: 20, column: 15 },
];

// =============================================================================
// CLEANUP
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// STATUSBAR TESTS
// =============================================================================

describe('StatusBar', () => {
  it('renders all subcomponents', () => {
    const onErrorClick = vi.fn();

    render(
      <StatusBar
        fileName="test.mdx"
        isDirty={false}
        line={1}
        column={1}
        errors={[]}
        onErrorClick={onErrorClick}
      />
    );

    expect(screen.getByTestId('status-bar')).toBeTruthy();
    expect(screen.getByTestId('file-info-name')).toBeTruthy();
    expect(screen.getByTestId('cursor-position')).toBeTruthy();
    expect(screen.getByTestId('error-count')).toBeTruthy();
  });

  it('passes props correctly to subcomponents', () => {
    const onErrorClick = vi.fn();

    render(
      <StatusBar
        fileName="document.mdx"
        isDirty={true}
        line={42}
        column={15}
        errors={mockErrors}
        onErrorClick={onErrorClick}
      />
    );

    // FileInfo should show filename and dirty indicator
    expect(screen.getByTestId('file-info-name').textContent).toContain('document.mdx');
    expect(screen.getByTestId('file-info-dirty')).toBeTruthy();

    // CursorPosition should show correct line and column
    expect(screen.getByTestId('cursor-position').textContent).toContain('Ln 42, Col 15');

    // ErrorCount should show error count
    expect(screen.getByTestId('error-count').textContent).toContain('3 errors');
  });

  it('renders with orphan file indicator', () => {
    const onErrorClick = vi.fn();

    render(
      <StatusBar
        fileName="deleted.mdx"
        isDirty={false}
        isOrphan={true}
        line={1}
        column={1}
        errors={[]}
        onErrorClick={onErrorClick}
      />
    );

    expect(screen.getByTestId('file-info-orphan').textContent).toContain('(Deleted)');
  });

  it('has correct accessibility attributes', () => {
    const onErrorClick = vi.fn();

    render(
      <StatusBar
        fileName="test.mdx"
        isDirty={false}
        line={1}
        column={1}
        errors={[]}
        onErrorClick={onErrorClick}
      />
    );

    const statusBar = screen.getByTestId('status-bar');
    expect(statusBar.getAttribute('role')).toBe('status');
    expect(statusBar.getAttribute('aria-label')).toBe('Status bar');
  });
});

// =============================================================================
// FILEINFO TESTS
// =============================================================================

describe('FileInfo', () => {
  it('displays filename', () => {
    render(<FileInfo fileName="example.mdx" isDirty={false} />);

    expect(screen.getByTestId('file-info-name').textContent).toContain('example.mdx');
  });

  it('shows dirty indicator when dirty', () => {
    render(<FileInfo fileName="example.mdx" isDirty={true} />);

    const dirtyIndicator = screen.getByTestId('file-info-dirty');
    expect(dirtyIndicator).toBeTruthy();
    // Check for the bullet character
    expect(dirtyIndicator.textContent).toContain('\u2022');
  });

  it('does not show dirty indicator when not dirty', () => {
    render(<FileInfo fileName="example.mdx" isDirty={false} />);

    expect(screen.queryByTestId('file-info-dirty')).toBeNull();
  });

  it('shows orphan indicator when file is deleted', () => {
    render(<FileInfo fileName="deleted.mdx" isDirty={false} isOrphan={true} />);

    expect(screen.getByTestId('file-info-orphan').textContent).toContain('(Deleted)');
  });

  it('does not show dirty indicator when orphan (priority)', () => {
    // When file is orphan, we show (Deleted) instead of dirty indicator
    render(<FileInfo fileName="deleted.mdx" isDirty={true} isOrphan={true} />);

    expect(screen.getByTestId('file-info-orphan')).toBeTruthy();
    expect(screen.queryByTestId('file-info-dirty')).toBeNull();
  });

  it('has correct title with status info', () => {
    const { container } = render(<FileInfo fileName="doc.mdx" isDirty={true} />);

    const wrapper = container.querySelector('[title]');
    expect(wrapper?.getAttribute('title')).toBe('doc.mdx (unsaved)');
  });
});

// =============================================================================
// CURSORPOSITION TESTS
// =============================================================================

describe('CursorPosition', () => {
  it('displays line and column', () => {
    render(<CursorPosition line={42} column={15} />);

    expect(screen.getByTestId('cursor-position').textContent).toContain('Ln 42, Col 15');
  });

  it('displays line 1, column 1 correctly', () => {
    render(<CursorPosition line={1} column={1} />);

    expect(screen.getByTestId('cursor-position').textContent).toContain('Ln 1, Col 1');
  });

  it('displays large line numbers correctly', () => {
    render(<CursorPosition line={9999} column={100} />);

    expect(screen.getByTestId('cursor-position').textContent).toContain('Ln 9999, Col 100');
  });

  it('has correct accessibility attributes', () => {
    render(<CursorPosition line={10} column={5} />);

    const element = screen.getByTestId('cursor-position');
    expect(element.getAttribute('aria-label')).toBe('Line 10, Column 5');
  });
});

// =============================================================================
// ERRORCOUNT TESTS
// =============================================================================

describe('ErrorCount', () => {
  it('shows error count', () => {
    const onErrorClick = vi.fn();

    render(<ErrorCount errors={mockErrors} onErrorClick={onErrorClick} />);

    expect(screen.getByTestId('error-count').textContent).toContain('3 errors');
  });

  it('shows singular form for one error', () => {
    const onErrorClick = vi.fn();
    const singleError: CompilationError[] = [{ message: 'Error', line: 1, column: 1 }];

    render(<ErrorCount errors={singleError} onErrorClick={onErrorClick} />);

    expect(screen.getByTestId('error-count').textContent).toContain('1 error');
  });

  it('shows "No errors" when empty', () => {
    const onErrorClick = vi.fn();

    render(<ErrorCount errors={[]} onErrorClick={onErrorClick} />);

    expect(screen.getByTestId('error-count').textContent).toContain('No errors');
  });

  it('popover opens on click', async () => {
    const onErrorClick = vi.fn();

    render(<ErrorCount errors={mockErrors} onErrorClick={onErrorClick} />);

    const button = screen.getByTestId('error-count');
    fireEvent.click(button);

    // Wait for popover to appear
    await waitFor(() => {
      expect(screen.getByTestId('error-popover')).toBeTruthy();
    });
  });

  it('popover shows error details', async () => {
    const onErrorClick = vi.fn();

    render(<ErrorCount errors={mockErrors} onErrorClick={onErrorClick} />);

    const button = screen.getByTestId('error-count');
    fireEvent.click(button);

    // Wait for popover and check error details
    await waitFor(() => {
      expect(screen.getByTestId('error-popover')).toBeTruthy();
    });

    // Check that all error messages are displayed
    expect(screen.getByText('Unexpected token')).toBeTruthy();
    expect(screen.getByText('Missing closing bracket')).toBeTruthy();
    expect(screen.getByText('Invalid JSX syntax')).toBeTruthy();

    // Check that locations are displayed
    expect(screen.getByText('Ln 5, Col 10')).toBeTruthy();
    expect(screen.getByText('Ln 12, Col 1')).toBeTruthy();
    expect(screen.getByText('Ln 20, Col 15')).toBeTruthy();
  });

  it('clicking error in popover calls onErrorClick', async () => {
    const onErrorClick = vi.fn();

    render(<ErrorCount errors={mockErrors} onErrorClick={onErrorClick} />);

    // Open popover
    const button = screen.getByTestId('error-count');
    fireEvent.click(button);

    // Wait for popover
    await waitFor(() => {
      expect(screen.getByTestId('error-popover')).toBeTruthy();
    });

    // Click on the first error item
    const errorItems = screen.getAllByTestId('error-item');
    expect(errorItems.length).toBeGreaterThan(0);
    fireEvent.click(errorItems[0]!);

    expect(onErrorClick).toHaveBeenCalledWith(mockErrors[0]);
  });

  it('popover dismisses on Escape key', async () => {
    const onErrorClick = vi.fn();

    render(<ErrorCount errors={mockErrors} onErrorClick={onErrorClick} />);

    // Open popover
    const button = screen.getByTestId('error-count');
    fireEvent.click(button);

    // Wait for popover to open
    await waitFor(() => {
      expect(screen.getByTestId('error-popover')).toBeTruthy();
    });

    // Press Escape - dispatch on document
    fireEvent.keyDown(document, { key: 'Escape' });

    // Wait for popover to close
    await waitFor(() => {
      expect(screen.queryByTestId('error-popover')).toBeNull();
    });
  });

  it('has correct accessibility label', () => {
    const onErrorClick = vi.fn();

    render(<ErrorCount errors={mockErrors} onErrorClick={onErrorClick} />);

    const button = screen.getByTestId('error-count');
    expect(button.getAttribute('aria-label')).toBe('3 errors. Click to view details.');
  });

  it('error items are keyboard accessible', async () => {
    const onErrorClick = vi.fn();

    render(<ErrorCount errors={mockErrors} onErrorClick={onErrorClick} />);

    // Open popover
    const button = screen.getByTestId('error-count');
    fireEvent.click(button);

    // Wait for popover
    await waitFor(() => {
      expect(screen.getByTestId('error-popover')).toBeTruthy();
    });

    // Tab to first error item and press Enter
    const errorItems = screen.getAllByTestId('error-item');
    expect(errorItems.length).toBeGreaterThan(0);
    fireEvent.keyDown(errorItems[0]!, { key: 'Enter' });

    expect(onErrorClick).toHaveBeenCalledWith(mockErrors[0]);
  });

  it('error items respond to Space key', async () => {
    const onErrorClick = vi.fn();

    render(<ErrorCount errors={mockErrors} onErrorClick={onErrorClick} />);

    // Open popover
    const button = screen.getByTestId('error-count');
    fireEvent.click(button);

    // Wait for popover
    await waitFor(() => {
      expect(screen.getByTestId('error-popover')).toBeTruthy();
    });

    // Press Space on first error item
    const errorItems = screen.getAllByTestId('error-item');
    expect(errorItems.length).toBeGreaterThan(0);
    fireEvent.keyDown(errorItems[0]!, { key: ' ' });

    expect(onErrorClick).toHaveBeenCalledWith(mockErrors[0]);
  });
});
