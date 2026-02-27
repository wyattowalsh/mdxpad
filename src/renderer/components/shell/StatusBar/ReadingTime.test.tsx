/**
 * ReadingTime Component Tests
 *
 * Tests for reading time status bar widget rendering.
 *
 * @module renderer/components/shell/StatusBar/ReadingTime.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReadingTime } from './ReadingTime';

describe('ReadingTime', () => {
  it('should display 0 min read for empty text', () => {
    render(<ReadingTime minutes={0} seconds={0} />);
    expect(screen.getByText('0 min read')).toBeTruthy();
  });

  it('should display < 1 min read for short text', () => {
    render(<ReadingTime minutes={0} seconds={30} />);
    expect(screen.getByText('< 1 min read')).toBeTruthy();
  });

  it('should display minutes for longer text', () => {
    render(<ReadingTime minutes={5} seconds={0} />);
    expect(screen.getByText('5 min read')).toBeTruthy();
  });

  it('should display minutes and ignore seconds in display', () => {
    render(<ReadingTime minutes={3} seconds={45} />);
    expect(screen.getByText('3 min read')).toBeTruthy();
  });

  it('should have correct test id', () => {
    render(<ReadingTime minutes={1} seconds={0} />);
    expect(screen.getByTestId('reading-time')).toBeTruthy();
  });
});
