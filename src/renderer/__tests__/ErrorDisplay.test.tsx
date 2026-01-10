/**
 * Tests for ErrorDisplay component.
 * Validates error rendering, accessibility, and user interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorDisplay } from '../components/preview/ErrorDisplay';
import type { CompileError } from '@shared/types/preview';

describe('ErrorDisplay', () => {
  const mockOnErrorClick = vi.fn();

  beforeEach(() => {
    mockOnErrorClick.mockClear();
  });

  // Test case 1: Renders nothing when errors array is empty
  it('renders nothing when errors array is empty', () => {
    const { container } = render(
      <ErrorDisplay errors={[]} onErrorClick={mockOnErrorClick} />
    );

    expect(container.firstChild).toBeNull();
  });

  // Test case 2: Renders error panel with role="alert"
  it('renders error panel with role="alert"', () => {
    const errors: CompileError[] = [{ message: 'Test error' }];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    const alertElement = screen.getByRole('alertdialog');
    expect(alertElement).toBeDefined();
    expect(alertElement.getAttribute('aria-live')).toBe('assertive');
  });

  // Test case 3: Displays error message
  it('displays error message', () => {
    const errors: CompileError[] = [{ message: 'Syntax error: unexpected token' }];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    expect(screen.getByText('Syntax error: unexpected token')).toBeDefined();
  });

  // Test case 4: Displays line and column when available
  it('displays line and column when available', () => {
    const errors: CompileError[] = [
      { message: 'Test error', line: 10, column: 5 },
    ];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    const locationButton = screen.getByRole('button', {
      name: 'Go to Line 10, Column 5',
    });
    expect(locationButton).toBeDefined();
    expect(locationButton.textContent).toBe('Line 10, Column 5');
  });

  // Test case 5: onClick calls onErrorClick with line and column
  it('onClick calls onErrorClick with line and column', () => {
    const errors: CompileError[] = [
      { message: 'Test error', line: 15, column: 8 },
    ];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    const locationButton = screen.getByRole('button', {
      name: 'Go to Line 15, Column 8',
    });
    fireEvent.click(locationButton);

    expect(mockOnErrorClick).toHaveBeenCalledTimes(1);
    expect(mockOnErrorClick).toHaveBeenCalledWith(15, 8);
  });

  // Test case 6: Multiple errors are displayed
  it('displays multiple errors', () => {
    const errors: CompileError[] = [
      { message: 'First error', line: 1, column: 1 },
      { message: 'Second error', line: 2, column: 2 },
      { message: 'Third error', line: 3, column: 3 },
    ];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    // Check header shows correct count
    expect(screen.getByText('3 Compilation Errors')).toBeDefined();

    // Check all error messages are displayed
    expect(screen.getByText('First error')).toBeDefined();
    expect(screen.getByText('Second error')).toBeDefined();
    expect(screen.getByText('Third error')).toBeDefined();

    // Check all location buttons are present
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });

  // Test case 7: Error without position info still renders
  it('renders error without position info', () => {
    const errors: CompileError[] = [{ message: 'Error without location' }];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    expect(screen.getByText('Error without location')).toBeDefined();
    // Should not render any location button
    expect(screen.queryByRole('button')).toBeNull();
  });

  // Test case 8: Keyboard accessibility (Enter/Space triggers click)
  it('triggers click on Enter key', () => {
    const errors: CompileError[] = [
      { message: 'Test error', line: 20, column: 10 },
    ];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    const locationButton = screen.getByRole('button', {
      name: 'Go to Line 20, Column 10',
    });

    fireEvent.keyDown(locationButton, { key: 'Enter' });

    expect(mockOnErrorClick).toHaveBeenCalledTimes(1);
    expect(mockOnErrorClick).toHaveBeenCalledWith(20, 10);
  });

  it('triggers click on Space key', () => {
    const errors: CompileError[] = [
      { message: 'Test error', line: 25, column: 15 },
    ];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    const locationButton = screen.getByRole('button', {
      name: 'Go to Line 25, Column 15',
    });

    fireEvent.keyDown(locationButton, { key: ' ' });

    expect(mockOnErrorClick).toHaveBeenCalledTimes(1);
    expect(mockOnErrorClick).toHaveBeenCalledWith(25, 15);
  });

  it('does not trigger click on other keys', () => {
    const errors: CompileError[] = [
      { message: 'Test error', line: 30, column: 20 },
    ];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    const locationButton = screen.getByRole('button', {
      name: 'Go to Line 30, Column 20',
    });

    fireEvent.keyDown(locationButton, { key: 'Tab' });
    fireEvent.keyDown(locationButton, { key: 'Escape' });
    fireEvent.keyDown(locationButton, { key: 'a' });

    expect(mockOnErrorClick).not.toHaveBeenCalled();
  });

  // Test case 9: Focus states work correctly
  it('button elements are focusable', () => {
    const errors: CompileError[] = [
      { message: 'Test error', line: 5, column: 3 },
    ];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    const locationButton = screen.getByRole('button', {
      name: 'Go to Line 5, Column 3',
    });

    // Button should be focusable (type="button" ensures it)
    expect(locationButton.getAttribute('type')).toBe('button');

    // Focus the button and verify it receives focus
    locationButton.focus();
    expect(document.activeElement).toBe(locationButton);
  });

  // Test case 10: Error count is shown in header
  it('shows singular header for single error', () => {
    const errors: CompileError[] = [{ message: 'Single error' }];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    expect(screen.getByText('Compilation Error')).toBeDefined();
  });

  it('shows plural header with count for multiple errors', () => {
    const errors: CompileError[] = [
      { message: 'Error 1' },
      { message: 'Error 2' },
    ];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    expect(screen.getByText('2 Compilation Errors')).toBeDefined();
  });

  // Additional tests for edge cases
  it('displays line only when column is undefined', () => {
    const errors: CompileError[] = [{ message: 'Test error', line: 42 }];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    const locationButton = screen.getByRole('button', {
      name: 'Go to Line 42',
    });
    expect(locationButton).toBeDefined();
    expect(locationButton.textContent).toBe('Line 42');
  });

  it('calls onErrorClick with undefined column when column not provided', () => {
    const errors: CompileError[] = [{ message: 'Test error', line: 50 }];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    const locationButton = screen.getByRole('button', {
      name: 'Go to Line 50',
    });
    fireEvent.click(locationButton);

    expect(mockOnErrorClick).toHaveBeenCalledWith(50, undefined);
  });

  it('applies custom className', () => {
    const errors: CompileError[] = [{ message: 'Test error' }];

    render(
      <ErrorDisplay
        errors={errors}
        onErrorClick={mockOnErrorClick}
        className="custom-class"
      />
    );

    const container = screen.getByRole('alertdialog');
    expect(container.className).toContain('custom-class');
    expect(container.className).toContain('preview-error-container');
  });

  it('renders error list with aria-label', () => {
    const errors: CompileError[] = [{ message: 'Test error' }];

    render(<ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />);

    const errorList = screen.getByRole('list', { name: 'Error list' });
    expect(errorList).toBeDefined();
  });

  it('works without onErrorClick callback', () => {
    const errors: CompileError[] = [
      { message: 'Test error', line: 10, column: 5 },
    ];

    render(<ErrorDisplay errors={errors} />);

    const locationButton = screen.getByRole('button', {
      name: 'Go to Line 10, Column 5',
    });

    // Should not throw when clicking without callback
    expect(() => fireEvent.click(locationButton)).not.toThrow();
  });

  it('renders warning icon in header', () => {
    const errors: CompileError[] = [{ message: 'Test error' }];

    const { container } = render(
      <ErrorDisplay errors={errors} onErrorClick={mockOnErrorClick} />
    );

    const icon = container.querySelector('.preview-error-icon');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });
});
