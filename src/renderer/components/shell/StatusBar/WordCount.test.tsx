/**
 * WordCount Component Tests
 *
 * Tests for word count status bar widget rendering.
 *
 * @module renderer/components/shell/StatusBar/WordCount.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@ui/tooltip';
import { WordCount } from './WordCount';

function renderWordCount(wordCount: number, charCount: number) {
  return render(
    <TooltipProvider>
      <WordCount wordCount={wordCount} charCount={charCount} />
    </TooltipProvider>
  );
}

describe('WordCount', () => {
  it('should display word count', () => {
    renderWordCount(42, 200);
    expect(screen.getByTestId('word-count')).toBeTruthy();
    expect(screen.getByText('42 words')).toBeTruthy();
  });

  it('should show singular form for 1 word', () => {
    renderWordCount(1, 4);
    expect(screen.getByText('1 word')).toBeTruthy();
  });

  it('should format large numbers with locale', () => {
    renderWordCount(1234, 5678);
    expect(screen.getByTestId('word-count').textContent).toContain('1,234');
  });

  it('should display zero words', () => {
    renderWordCount(0, 0);
    expect(screen.getByText('0 words')).toBeTruthy();
  });
});
