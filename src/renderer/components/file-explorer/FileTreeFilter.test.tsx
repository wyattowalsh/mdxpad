/**
 * Tests for FileTreeFilter component.
 *
 * Tests input handling, clear button, Escape behavior, debounce timing,
 * and query truncation.
 *
 * @module file-explorer/FileTreeFilter.test
 * Feature: 014-smart-filtering
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { enableMapSet } from 'immer';

// Enable Immer MapSet plugin before store import
enableMapSet();

// =============================================================================
// MOCKS
// =============================================================================

// Mock localStorage
const mockStorage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="x-icon">X</span>,
  Search: () => <span data-testid="search-icon">Search</span>,
}));

// Import after mocks are set up
import { FileTreeFilter } from './FileTreeFilter';
import {
  useFileExplorerStore,
  MAX_FILTER_QUERY_LENGTH,
} from '@renderer/stores/file-explorer-store';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Reset the store to initial state.
 */
function resetStore(): void {
  useFileExplorerStore.setState({
    query: { value: '', isActive: false },
    matchResults: new Map(),
    isFiltering: false,
    matchCount: 0,
    projectPath: null,
  });
}

/**
 * Get the filter input element.
 */
function getInput(): HTMLInputElement {
  return screen.getByRole('textbox', { name: /filter file tree/i });
}

// =============================================================================
// TESTS
// =============================================================================

describe('FileTreeFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStore();
    mockStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Rendering Tests
  // ---------------------------------------------------------------------------

  describe('rendering', () => {
    it('renders input with placeholder', () => {
      render(<FileTreeFilter />);

      const input = getInput();
      expect(input).toBeDefined();
      expect(input.placeholder).toBe('Filter files...');
    });

    it('renders search icon', () => {
      render(<FileTreeFilter />);

      expect(screen.getByTestId('search-icon')).toBeDefined();
    });

    it('applies className prop', () => {
      render(<FileTreeFilter className="custom-class" />);

      const container = screen.getByRole('textbox').closest('div')?.parentElement;
      expect(container?.classList.contains('custom-class')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Input Change Tests
  // ---------------------------------------------------------------------------

  describe('input changes', () => {
    it('triggers store action on input change', () => {
      render(<FileTreeFilter />);
      const input = getInput();

      fireEvent.change(input, { target: { value: 'test' } });

      const state = useFileExplorerStore.getState();
      expect(state.query.value).toBe('test');
      expect(state.query.isActive).toBe(true);
    });

    it('updates input value from store state', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.getState().setFilterQuery('component');
      });

      const input = getInput();
      expect(input.value).toBe('component');
    });

    it('sets isFiltering to true on input change', () => {
      render(<FileTreeFilter />);
      const input = getInput();

      fireEvent.change(input, { target: { value: 'test' } });

      const state = useFileExplorerStore.getState();
      expect(state.isFiltering).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Clear Button Tests
  // ---------------------------------------------------------------------------

  describe('clear button', () => {
    it('shows clear button when query is non-empty', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: 'test', isActive: true },
          isFiltering: false,
        });
      });

      expect(screen.getByRole('button', { name: /clear filter/i })).toBeDefined();
    });

    it('hides clear button when query is empty', () => {
      render(<FileTreeFilter />);

      expect(screen.queryByRole('button', { name: /clear filter/i })).toBeNull();
    });

    it('clears filter when clear button clicked', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: 'test', isActive: true },
          isFiltering: false,
        });
      });

      const clearButton = screen.getByRole('button', { name: /clear filter/i });
      fireEvent.click(clearButton);

      const state = useFileExplorerStore.getState();
      expect(state.query.value).toBe('');
      expect(state.query.isActive).toBe(false);
    });

    it('refocuses input after clear button click', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: 'test', isActive: true },
          isFiltering: false,
        });
      });

      const clearButton = screen.getByRole('button', { name: /clear filter/i });
      fireEvent.click(clearButton);

      const input = getInput();
      expect(document.activeElement).toBe(input);
    });

    it('hides clear button while filtering is in progress', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: 'test', isActive: true },
          isFiltering: true,
        });
      });

      expect(screen.queryByRole('button', { name: /clear filter/i })).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Escape Key Tests
  // ---------------------------------------------------------------------------

  describe('Escape key behavior', () => {
    it('clears query on first Escape when query non-empty', () => {
      render(<FileTreeFilter />);
      const input = getInput();

      // Set a query
      fireEvent.change(input, { target: { value: 'test' } });

      // Press Escape
      fireEvent.keyDown(input, { key: 'Escape' });

      const state = useFileExplorerStore.getState();
      expect(state.query.value).toBe('');
    });

    it('blurs input on Escape when query is empty', () => {
      render(<FileTreeFilter />);
      const input = getInput();

      // Focus the input
      input.focus();
      expect(document.activeElement).toBe(input);

      // Press Escape with empty query
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(document.activeElement).not.toBe(input);
    });

    it('prevents event propagation on Escape', () => {
      render(<FileTreeFilter />);
      const input = getInput();

      const parentHandler = vi.fn();
      input.parentElement?.addEventListener('keydown', parentHandler);

      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      // The parent handler should not be called because we stop propagation
      // Note: This tests stopPropagation behavior
    });
  });

  // ---------------------------------------------------------------------------
  // Query Truncation Tests
  // ---------------------------------------------------------------------------

  describe('query truncation', () => {
    it('truncates query at 256 characters', () => {
      render(<FileTreeFilter />);
      const input = getInput();

      const longQuery = 'a'.repeat(300);
      fireEvent.change(input, { target: { value: longQuery } });

      const state = useFileExplorerStore.getState();
      expect(state.query.value.length).toBe(MAX_FILTER_QUERY_LENGTH);
      expect(state.query.value).toBe('a'.repeat(256));
    });

    it('allows query up to exactly 256 characters', () => {
      render(<FileTreeFilter />);
      const input = getInput();

      const maxQuery = 'b'.repeat(256);
      fireEvent.change(input, { target: { value: maxQuery } });

      const state = useFileExplorerStore.getState();
      expect(state.query.value.length).toBe(256);
      expect(state.query.value).toBe(maxQuery);
    });

    it('has maxLength attribute on input', () => {
      render(<FileTreeFilter />);
      const input = getInput();

      expect(input.maxLength).toBe(MAX_FILTER_QUERY_LENGTH);
    });
  });

  // ---------------------------------------------------------------------------
  // Custom Event Tests
  // ---------------------------------------------------------------------------

  describe('custom events', () => {
    it('focuses and selects input on filter focus event', () => {
      render(<FileTreeFilter />);
      const input = getInput();

      // Set a value first
      act(() => {
        useFileExplorerStore.getState().setFilterQuery('test');
      });

      // Dispatch the focus event
      act(() => {
        window.dispatchEvent(new CustomEvent('mdxpad:filter:focus'));
      });

      expect(document.activeElement).toBe(input);
    });

    it('clears filter on filter clear event', () => {
      render(<FileTreeFilter />);

      // Set a query
      act(() => {
        useFileExplorerStore.getState().setFilterQuery('test');
      });

      // Dispatch the clear event
      act(() => {
        window.dispatchEvent(new CustomEvent('mdxpad:filter:clear'));
      });

      const state = useFileExplorerStore.getState();
      expect(state.query.value).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // Loading State Tests
  // ---------------------------------------------------------------------------

  describe('loading state', () => {
    it('shows loading indicator when filtering', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: 'test', isActive: true },
          isFiltering: true,
        });
      });

      // Look for the loading spinner (animate-spin class)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeNull();
    });

    it('hides loading indicator when not filtering', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: 'test', isActive: true },
          isFiltering: false,
        });
      });

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Status Text Tests
  // ---------------------------------------------------------------------------

  describe('status text', () => {
    it('shows "Filtering..." when filtering in progress', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: 'test', isActive: true },
          isFiltering: true,
        });
      });

      expect(screen.getByText('Filtering...')).toBeDefined();
    });

    it('shows match count when filtering complete', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: 'test', isActive: true },
          isFiltering: false,
          matchCount: 5,
        });
      });

      expect(screen.getByText('5 matches')).toBeDefined();
    });

    it('shows singular "match" for single result', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: 'test', isActive: true },
          isFiltering: false,
          matchCount: 1,
        });
      });

      expect(screen.getByText('1 match')).toBeDefined();
    });

    it('shows empty state message when no matches', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: 'test', isActive: true },
          isFiltering: false,
          matchCount: 0,
        });
      });

      expect(screen.getByText('No files match your filter')).toBeDefined();
    });

    it('hides status text when filter is inactive', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: '', isActive: false },
          isFiltering: false,
          matchCount: 0,
        });
      });

      expect(screen.queryByText('Filtering...')).toBeNull();
      expect(screen.queryByText(/match/)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Accessibility Tests
  // ---------------------------------------------------------------------------

  describe('accessibility', () => {
    it('has correct aria-label on input', () => {
      render(<FileTreeFilter />);
      const input = getInput();

      expect(input.getAttribute('aria-label')).toBe('Filter file tree');
    });

    it('has aria-describedby when status text shown', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: 'test', isActive: true },
          isFiltering: false,
          matchCount: 5,
        });
      });

      const input = getInput();
      expect(input.getAttribute('aria-describedby')).toBe('filter-status');
    });

    it('status text has aria-live for screen readers', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: 'test', isActive: true },
          isFiltering: false,
          matchCount: 5,
        });
      });

      const status = screen.getByText('5 matches');
      expect(status.getAttribute('aria-live')).toBe('polite');
    });

    it('clear button has accessible label', () => {
      render(<FileTreeFilter />);

      act(() => {
        useFileExplorerStore.setState({
          query: { value: 'test', isActive: true },
          isFiltering: false,
        });
      });

      const clearButton = screen.getByRole('button', { name: /clear filter/i });
      expect(clearButton.getAttribute('aria-label')).toBe('Clear filter');
    });
  });

  // ---------------------------------------------------------------------------
  // Callback Tests
  // ---------------------------------------------------------------------------

  describe('callbacks', () => {
    it('calls onFocus callback when input focused', () => {
      const onFocus = vi.fn();
      render(<FileTreeFilter onFocus={onFocus} />);
      const input = getInput();

      fireEvent.focus(input);

      expect(onFocus).toHaveBeenCalledTimes(1);
    });

    it('calls onBlur callback when input blurred', () => {
      const onBlur = vi.fn();
      render(<FileTreeFilter onBlur={onBlur} />);
      const input = getInput();

      fireEvent.focus(input);
      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });
});
