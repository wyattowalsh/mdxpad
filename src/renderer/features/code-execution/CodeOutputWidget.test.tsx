/**
 * Unit tests for CodeOutputWidget component.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodeOutputWidget } from './CodeOutputWidget';

describe('CodeOutputWidget', () => {
  const defaultProps = {
    success: true,
    logs: [] as string[],
    returnValue: null,
    error: null,
    durationMs: 10,
    isRunning: false,
  };

  it('renders running state', () => {
    render(<CodeOutputWidget {...defaultProps} isRunning={true} />);
    expect(screen.getByText('Running...')).toBeDefined();
  });

  it('renders no-output state', () => {
    render(<CodeOutputWidget {...defaultProps} />);
    expect(screen.getByText(/No output/)).toBeDefined();
  });

  it('renders console logs', () => {
    render(<CodeOutputWidget {...defaultProps} logs={['hello world', 'second line']} />);
    expect(screen.getByText('hello world')).toBeDefined();
    expect(screen.getByText('second line')).toBeDefined();
  });

  it('renders return value', () => {
    render(<CodeOutputWidget {...defaultProps} returnValue="42" />);
    expect(screen.getByText(/42/)).toBeDefined();
  });

  it('renders error message', () => {
    render(
      <CodeOutputWidget
        {...defaultProps}
        success={false}
        error="ReferenceError: x is not defined"
      />
    );
    expect(screen.getByText(/ReferenceError/)).toBeDefined();
  });

  it('shows duration', () => {
    render(<CodeOutputWidget {...defaultProps} logs={['test']} durationMs={123.456} />);
    expect(screen.getByText(/123ms/)).toBeDefined();
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn();
    render(<CodeOutputWidget {...defaultProps} logs={['output']} onDismiss={onDismiss} />);
    const button = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(button);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does not render dismiss button without onDismiss', () => {
    render(<CodeOutputWidget {...defaultProps} logs={['output']} />);
    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
  });

  it('renders success styling for successful execution', () => {
    const { container } = render(
      <CodeOutputWidget {...defaultProps} logs={['ok']} success={true} />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-green-500');
  });

  it('renders error styling for failed execution', () => {
    const { container } = render(
      <CodeOutputWidget {...defaultProps} success={false} error="fail" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-red-500');
  });
});
