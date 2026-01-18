/**
 * Tests for FilterHighlight component.
 *
 * Tests text segmentation and highlight rendering.
 *
 * @module file-explorer/FilterHighlight.test
 * Feature: 014-smart-filtering
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  FilterHighlight,
  positionsToSegments,
  type TextSegment,
} from './FilterHighlight';

// =============================================================================
// positionsToSegments TESTS
// =============================================================================

describe('positionsToSegments', () => {
  it('returns single unmatched segment for empty positions', () => {
    const result = positionsToSegments('MyComponent', new Set());

    expect(result).toEqual([{ text: 'MyComponent', isMatch: false }]);
  });

  it('returns single matched segment when all chars match', () => {
    const text = 'abc';
    const positions = new Set([0, 1, 2]);

    const result = positionsToSegments(text, positions);

    expect(result).toEqual([{ text: 'abc', isMatch: true }]);
  });

  it('groups consecutive matched characters', () => {
    const text = 'MyComponent';
    // Match "Com" (positions 2, 3, 4)
    const positions = new Set([2, 3, 4]);

    const result = positionsToSegments(text, positions);

    expect(result).toEqual([
      { text: 'My', isMatch: false },
      { text: 'Com', isMatch: true },
      { text: 'ponent', isMatch: false },
    ]);
  });

  it('handles alternating matched and unmatched characters', () => {
    const text = 'abcde';
    // Match positions 0, 2, 4 (alternating)
    const positions = new Set([0, 2, 4]);

    const result = positionsToSegments(text, positions);

    expect(result).toEqual([
      { text: 'a', isMatch: true },
      { text: 'b', isMatch: false },
      { text: 'c', isMatch: true },
      { text: 'd', isMatch: false },
      { text: 'e', isMatch: true },
    ]);
  });

  it('handles match at beginning only', () => {
    const text = 'HelloWorld';
    const positions = new Set([0, 1, 2, 3, 4]);

    const result = positionsToSegments(text, positions);

    expect(result).toEqual([
      { text: 'Hello', isMatch: true },
      { text: 'World', isMatch: false },
    ]);
  });

  it('handles match at end only', () => {
    const text = 'HelloWorld';
    const positions = new Set([5, 6, 7, 8, 9]);

    const result = positionsToSegments(text, positions);

    expect(result).toEqual([
      { text: 'Hello', isMatch: false },
      { text: 'World', isMatch: true },
    ]);
  });

  it('handles single character text', () => {
    const text = 'X';

    // Matched
    expect(positionsToSegments(text, new Set([0]))).toEqual([
      { text: 'X', isMatch: true },
    ]);

    // Unmatched
    expect(positionsToSegments(text, new Set())).toEqual([
      { text: 'X', isMatch: false },
    ]);
  });

  it('handles empty text', () => {
    const result = positionsToSegments('', new Set());

    // Empty text with no positions returns single empty unmatched segment
    // (this matches the component behavior of rendering an empty span)
    expect(result).toEqual([{ text: '', isMatch: false }]);
  });

  it('handles positions outside text range (ignores invalid)', () => {
    const text = 'abc';
    // Position 5 is out of range, should be ignored
    const positions = new Set([0, 5, 10]);

    const result = positionsToSegments(text, positions);

    // Only position 0 is valid
    expect(result).toEqual([
      { text: 'a', isMatch: true },
      { text: 'bc', isMatch: false },
    ]);
  });
});

// =============================================================================
// FilterHighlight Component TESTS
// =============================================================================

describe('FilterHighlight', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders plain text when positions is null', () => {
      render(<FilterHighlight text="MyComponent" positions={null} />);

      expect(screen.getByText('MyComponent')).toBeDefined();
    });

    it('renders plain text when positions is empty', () => {
      render(<FilterHighlight text="MyComponent" positions={new Set()} />);

      expect(screen.getByText('MyComponent')).toBeDefined();
    });

    it('renders text with highlighting for matched positions', () => {
      const { container } = render(
        <FilterHighlight text="MyComponent" positions={new Set([0, 1])} />
      );

      // Should have multiple spans for segments
      const spans = container.querySelectorAll('span > span');
      expect(spans.length).toBeGreaterThan(1);
    });

    it('applies highlight class to matched segments', () => {
      const { container } = render(
        <FilterHighlight text="abc" positions={new Set([0])} />
      );

      // First segment should have highlight class
      const matchedSpan = container.querySelector('.font-semibold');
      expect(matchedSpan).not.toBeNull();
      expect(matchedSpan?.textContent).toBe('a');
    });

    it('does not apply highlight class to unmatched segments', () => {
      const { container } = render(
        <FilterHighlight text="abc" positions={new Set([0])} />
      );

      // Find span without font-semibold class
      const spans = container.querySelectorAll('span > span');
      const unmatchedSpan = Array.from(spans).find(
        (span) => !span.classList.contains('font-semibold')
      );
      expect(unmatchedSpan).not.toBeNull();
      expect(unmatchedSpan?.textContent).toBe('bc');
    });
  });

  describe('custom className', () => {
    it('applies className to wrapper span', () => {
      const { container } = render(
        <FilterHighlight
          text="Test"
          positions={null}
          className="custom-class"
        />
      );

      const wrapper = container.querySelector('.custom-class');
      expect(wrapper).not.toBeNull();
    });
  });

  describe('custom highlightClassName', () => {
    it('uses custom highlight class', () => {
      const { container } = render(
        <FilterHighlight
          text="abc"
          positions={new Set([0])}
          highlightClassName="text-primary font-bold"
        />
      );

      const matchedSpan = container.querySelector('.text-primary');
      expect(matchedSpan).not.toBeNull();
    });

    it('uses default highlight class when not specified', () => {
      const { container } = render(
        <FilterHighlight text="abc" positions={new Set([0])} />
      );

      // Default class is 'font-semibold underline'
      const matchedSpan = container.querySelector('.font-semibold');
      expect(matchedSpan).not.toBeNull();
    });
  });

  describe('memoization', () => {
    it('has displayName for debugging', () => {
      expect(FilterHighlight.displayName).toBe('FilterHighlight');
    });
  });

  describe('complex scenarios', () => {
    it('renders correct segments for typical fuzzy match', () => {
      // Simulating "mcp" matching "MyComponent.tsx"
      // M=0, C=2, p=5
      const { container } = render(
        <FilterHighlight
          text="MyComponent.tsx"
          positions={new Set([0, 2, 5])}
        />
      );

      const spans = container.querySelectorAll('span > span');
      // Should have multiple segments due to non-consecutive matches
      expect(spans.length).toBeGreaterThan(1);
    });

    it('handles text with special characters', () => {
      const { container } = render(
        <FilterHighlight
          text="file.test.tsx"
          positions={new Set([0, 5, 6, 7, 8])}
        />
      );

      // Should render without errors - check combined text content
      const wrapper = container.querySelector('span');
      expect(wrapper?.textContent).toBe('file.test.tsx');
    });

    it('handles unicode characters', () => {
      const { container } = render(
        <FilterHighlight
          text="日本語.tsx"
          positions={new Set([0, 1])}
        />
      );

      // Should render without errors - check combined text content
      const wrapper = container.querySelector('span');
      expect(wrapper?.textContent).toBe('日本語.tsx');
    });
  });
});
