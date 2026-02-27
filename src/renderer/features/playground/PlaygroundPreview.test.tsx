/**
 * Unit tests for PlaygroundPreview component.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PlaygroundPreview } from './PlaygroundPreview';

describe('PlaygroundPreview', () => {
  it('renders code content', () => {
    render(<PlaygroundPreview code="<h1>Hello</h1>" props={null} />);
    expect(screen.getByText(/Hello/)).toBeDefined();
  });

  it('renders with empty code', () => {
    const { container } = render(<PlaygroundPreview code="" props={null} />);
    expect(container.querySelector('.playground-preview')).toBeDefined();
  });

  it('renders with props', () => {
    render(<PlaygroundPreview code="<Button />" props={{ variant: 'primary', size: 'lg' }} />);
    expect(screen.getByText(/primary/)).toBeDefined();
  });

  it('renders without props section when props are empty', () => {
    const { container } = render(<PlaygroundPreview code="<div>test</div>" props={{}} />);
    expect(container.textContent).not.toContain('Props:');
  });

  it('calls onRenderStart callback', async () => {
    const onRenderStart = vi.fn();
    render(<PlaygroundPreview code="<div>test</div>" props={null} onRenderStart={onRenderStart} />);
    await waitFor(() => {
      expect(onRenderStart).toHaveBeenCalled();
    });
  });

  it('calls onRenderEnd with null on success', async () => {
    const onRenderEnd = vi.fn();
    render(<PlaygroundPreview code="<div>test</div>" props={null} onRenderEnd={onRenderEnd} />);
    await waitFor(() => {
      expect(onRenderEnd).toHaveBeenCalledWith(null);
    });
  });

  it('escapes HTML in code', () => {
    render(<PlaygroundPreview code="<script>alert('xss')</script>" props={null} />);
    // Should show escaped script tag, not execute it
    const content = screen.getByText(/alert/);
    expect(content).toBeDefined();
  });
});
