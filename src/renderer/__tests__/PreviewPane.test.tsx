/**
 * Tests for PreviewPane component.
 * Validates rendering of security warning, performance warning, loading state,
 * error display, and preview frame with proper prop passing.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewPane } from '../components/preview/PreviewPane';
import { usePreview } from '@renderer/hooks/usePreview';
import type { PreviewState, CompileSuccess, CompileError } from '@shared/types/preview';

// Mock the usePreview hook
vi.mock('@renderer/hooks/usePreview', () => ({
  usePreview: vi.fn(() => ({
    state: { status: 'idle' },
    lastSuccessfulRender: null,
    scrollRatio: 0,
    setScrollRatio: vi.fn(),
  })),
}));

// Mock child components to isolate PreviewPane testing
vi.mock('../components/preview/ErrorDisplay', () => ({
  ErrorDisplay: vi.fn(({ errors, onErrorClick }) => (
    <div data-testid="error-display" data-error-count={errors.length}>
      {errors.map((error: CompileError, idx: number) => (
        <div key={idx} data-testid="error-item">
          {error.message}
          {error.line !== undefined && (
            <button
              type="button"
              data-testid="error-location"
              onClick={() => onErrorClick?.(error.line!, error.column)}
            >
              Line {error.line}
            </button>
          )}
        </div>
      ))}
    </div>
  )),
}));

vi.mock('../components/preview/LoadingIndicator', () => ({
  LoadingIndicator: vi.fn(({ isLoading }) =>
    isLoading ? <div data-testid="loading-indicator">Compiling...</div> : null
  ),
}));

vi.mock('../components/preview/PreviewFrame', () => ({
  PreviewFrame: vi.fn(({ code, frontmatter, scrollRatio, theme }) => (
    <div
      data-testid="preview-frame"
      data-code={code}
      data-frontmatter={JSON.stringify(frontmatter)}
      data-scroll-ratio={scrollRatio}
      data-theme={theme}
    >
      Preview Frame
    </div>
  )),
}));

const mockedUsePreview = usePreview as Mock;

describe('PreviewPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default mock state
    mockedUsePreview.mockReturnValue({
      state: { status: 'idle' },
      lastSuccessfulRender: null,
      scrollRatio: 0,
      setScrollRatio: vi.fn(),
    });
  });

  // ============================================================================
  // Test 1: Renders security warning (FR-025)
  // ============================================================================
  it('renders security warning (FR-025)', () => {
    render(<PreviewPane source="" />);

    const warning = screen.getByText(/Preview executes code from your MDX/);
    expect(warning).toBeDefined();
    expect(warning.className).toContain('preview-warning');
  });

  // ============================================================================
  // Test 2: Shows performance warning for large documents (>50k chars)
  // ============================================================================
  it('shows performance warning for large documents (>50k chars)', () => {
    // Create a source string > 50000 chars
    const largeSource = 'x'.repeat(60000);

    render(<PreviewPane source={largeSource} />);

    const performanceWarning = screen.getByRole('alert');
    expect(performanceWarning).toBeDefined();
    expect(performanceWarning.className).toContain('preview-performance-warning');
    expect(performanceWarning.textContent).toContain('60k chars');
    expect(performanceWarning.textContent).toContain('may affect preview performance');
  });

  // ============================================================================
  // Test 3: Performance warning can be dismissed
  // ============================================================================
  it('performance warning can be dismissed', () => {
    const largeSource = 'x'.repeat(60000);

    render(<PreviewPane source={largeSource} />);

    // Verify warning is initially shown
    const performanceWarning = screen.getByRole('alert');
    expect(performanceWarning).toBeDefined();

    // Find and click dismiss button
    const dismissButton = screen.getByLabelText('Dismiss performance warning');
    expect(dismissButton).toBeDefined();

    fireEvent.click(dismissButton);

    // Warning should no longer be present
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // ============================================================================
  // Test 4: Shows LoadingIndicator when compiling
  // ============================================================================
  it('shows LoadingIndicator when compiling', () => {
    mockedUsePreview.mockReturnValue({
      state: { status: 'compiling' },
      lastSuccessfulRender: null,
      scrollRatio: 0,
      setScrollRatio: vi.fn(),
    });

    render(<PreviewPane source="# Hello" />);

    const loadingIndicator = screen.getByTestId('loading-indicator');
    expect(loadingIndicator).toBeDefined();
    expect(loadingIndicator.textContent).toBe('Compiling...');
  });

  // ============================================================================
  // Test 5: Shows ErrorDisplay when errors exist
  // ============================================================================
  it('shows ErrorDisplay when errors exist', () => {
    const errors: CompileError[] = [
      { message: 'Syntax error on line 5', line: 5, column: 10 },
      { message: 'Unexpected token', line: 12 },
    ];

    mockedUsePreview.mockReturnValue({
      state: { status: 'error', errors },
      lastSuccessfulRender: null,
      scrollRatio: 0,
      setScrollRatio: vi.fn(),
    });

    render(<PreviewPane source="invalid mdx" />);

    const errorDisplay = screen.getByTestId('error-display');
    expect(errorDisplay).toBeDefined();
    expect(errorDisplay.dataset.errorCount).toBe('2');

    const errorItems = screen.getAllByTestId('error-item');
    expect(errorItems.length).toBe(2);
    expect(errorItems[0]).toBeDefined();
    expect(errorItems[1]).toBeDefined();
    expect(errorItems[0]!.textContent).toContain('Syntax error on line 5');
    expect(errorItems[1]!.textContent).toContain('Unexpected token');
  });

  // ============================================================================
  // Test 6: Renders PreviewFrame when renderableContent exists
  // ============================================================================
  it('renders PreviewFrame when renderableContent exists', () => {
    const result: CompileSuccess = {
      ok: true,
      code: 'function MDXContent() { return "Hello"; }',
      frontmatter: { title: 'Test' },
    };

    mockedUsePreview.mockReturnValue({
      state: { status: 'success', result },
      lastSuccessfulRender: null,
      scrollRatio: 0,
      setScrollRatio: vi.fn(),
    });

    render(<PreviewPane source="# Hello" />);

    const previewFrame = screen.getByTestId('preview-frame');
    expect(previewFrame).toBeDefined();
    expect(previewFrame.dataset.code).toBe(result.code);
    expect(previewFrame.dataset.frontmatter).toBe(JSON.stringify(result.frontmatter));
  });

  // ============================================================================
  // Test 7: Error recovery shows last successful render behind errors
  // ============================================================================
  it('error recovery shows last successful render behind errors', () => {
    const lastSuccessfulRender: CompileSuccess = {
      ok: true,
      code: 'function MDXContent() { return "Previous"; }',
      frontmatter: { title: 'Previous Render' },
    };

    const errors: CompileError[] = [
      { message: 'Current compilation failed', line: 1 },
    ];

    mockedUsePreview.mockReturnValue({
      state: { status: 'error', errors },
      lastSuccessfulRender,
      scrollRatio: 0,
      setScrollRatio: vi.fn(),
    });

    render(<PreviewPane source="broken mdx" />);

    // Both error display and preview frame should be shown
    const errorDisplay = screen.getByTestId('error-display');
    expect(errorDisplay).toBeDefined();

    const previewFrame = screen.getByTestId('preview-frame');
    expect(previewFrame).toBeDefined();
    expect(previewFrame.dataset.code).toBe(lastSuccessfulRender.code);
    expect(previewFrame.dataset.frontmatter).toBe(
      JSON.stringify(lastSuccessfulRender.frontmatter)
    );
  });

  // ============================================================================
  // Test 8: onErrorClick callback is passed to ErrorDisplay
  // ============================================================================
  it('onErrorClick callback is passed to ErrorDisplay', () => {
    const onErrorClick = vi.fn();
    const errors: CompileError[] = [
      { message: 'Error at line 5', line: 5, column: 10 },
    ];

    mockedUsePreview.mockReturnValue({
      state: { status: 'error', errors },
      lastSuccessfulRender: null,
      scrollRatio: 0,
      setScrollRatio: vi.fn(),
    });

    render(<PreviewPane source="error mdx" onErrorClick={onErrorClick} />);

    // Click on error location
    const errorLocation = screen.getByTestId('error-location');
    fireEvent.click(errorLocation);

    expect(onErrorClick).toHaveBeenCalledTimes(1);
    expect(onErrorClick).toHaveBeenCalledWith(5, 10);
  });

  // ============================================================================
  // Test 9: scrollRatio prop is passed to PreviewFrame
  // ============================================================================
  it('scrollRatio prop is passed to PreviewFrame', () => {
    const result: CompileSuccess = {
      ok: true,
      code: 'function MDXContent() { return "Hello"; }',
      frontmatter: {},
    };

    mockedUsePreview.mockReturnValue({
      state: { status: 'success', result },
      lastSuccessfulRender: null,
      scrollRatio: 0,
      setScrollRatio: vi.fn(),
    });

    render(<PreviewPane source="# Hello" scrollRatio={0.75} />);

    const previewFrame = screen.getByTestId('preview-frame');
    expect(previewFrame.dataset.scrollRatio).toBe('0.75');
  });

  // ============================================================================
  // Test 10: theme prop is passed to PreviewFrame
  // ============================================================================
  it('theme prop is passed to PreviewFrame', () => {
    const result: CompileSuccess = {
      ok: true,
      code: 'function MDXContent() { return "Hello"; }',
      frontmatter: {},
    };

    mockedUsePreview.mockReturnValue({
      state: { status: 'success', result },
      lastSuccessfulRender: null,
      scrollRatio: 0,
      setScrollRatio: vi.fn(),
    });

    render(<PreviewPane source="# Hello" theme="dark" />);

    const previewFrame = screen.getByTestId('preview-frame');
    expect(previewFrame.dataset.theme).toBe('dark');
  });

  // ============================================================================
  // Test 11: className prop is applied
  // ============================================================================
  it('className prop is applied', () => {
    const { container } = render(
      <PreviewPane source="" className="custom-class another-class" />
    );

    const previewPane = container.querySelector('.preview-pane');
    expect(previewPane).not.toBeNull();
    expect(previewPane?.className).toContain('preview-pane');
    expect(previewPane?.className).toContain('custom-class');
    expect(previewPane?.className).toContain('another-class');
  });

  // ============================================================================
  // Additional edge case tests
  // ============================================================================
  it('does not show performance warning for documents under threshold', () => {
    const smallSource = 'x'.repeat(40000); // Under 50k threshold

    render(<PreviewPane source={smallSource} />);

    // No alert should be present for small documents
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not show ErrorDisplay when no errors and status is not error', () => {
    mockedUsePreview.mockReturnValue({
      state: { status: 'idle' },
      lastSuccessfulRender: null,
      scrollRatio: 0,
      setScrollRatio: vi.fn(),
    });

    render(<PreviewPane source="" />);

    expect(screen.queryByTestId('error-display')).toBeNull();
  });

  it('does not show PreviewFrame when no renderable content', () => {
    mockedUsePreview.mockReturnValue({
      state: { status: 'idle' },
      lastSuccessfulRender: null,
      scrollRatio: 0,
      setScrollRatio: vi.fn(),
    });

    render(<PreviewPane source="" />);

    expect(screen.queryByTestId('preview-frame')).toBeNull();
  });

  it('does not show LoadingIndicator when not compiling', () => {
    mockedUsePreview.mockReturnValue({
      state: { status: 'idle' },
      lastSuccessfulRender: null,
      scrollRatio: 0,
      setScrollRatio: vi.fn(),
    });

    render(<PreviewPane source="" />);

    expect(screen.queryByTestId('loading-indicator')).toBeNull();
  });
});
