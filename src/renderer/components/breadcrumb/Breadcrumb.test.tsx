/**
 * Breadcrumb Component Tests
 *
 * Tests for rendering breadcrumb segments and navigation.
 *
 * @module renderer/components/breadcrumb/Breadcrumb.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useOutlineStore } from '@renderer/stores/outline-store';
import { useWorkspaceStore } from '@renderer/stores/workspace-store';
import { Breadcrumb } from './Breadcrumb';

describe('Breadcrumb', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useOutlineStore.getState().reset();
    useWorkspaceStore.getState().reset();
  });

  it('should render file segment for untitled document', () => {
    render(<Breadcrumb />);

    expect(screen.getByTestId('breadcrumb-segment-file')).toBeTruthy();
    expect(screen.getByText('Untitled')).toBeTruthy();
  });

  it('should render file name when document is loaded', () => {
    useDocumentStore.setState({
      fileName: 'readme.mdx',
      filePath: '/workspace/docs/readme.mdx',
    });

    render(<Breadcrumb />);

    expect(screen.getByText('readme.mdx')).toBeTruthy();
  });

  it('should call onSegmentClick when a segment is clicked', () => {
    const onClick = vi.fn();
    render(<Breadcrumb onSegmentClick={onClick} />);

    const fileBtn = screen.getByTestId('breadcrumb-btn-file');
    fireEvent.click(fileBtn);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'file', label: 'Untitled' })
    );
  });

  it('should have proper aria label', () => {
    render(<Breadcrumb />);

    expect(screen.getByLabelText('Breadcrumb navigation')).toBeTruthy();
  });
});
