/**
 * TabBar Component Tests
 *
 * Tests for rendering tabs, switching on click, and close button.
 *
 * @module renderer/components/tabs/TabBar.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTabStore } from '@renderer/stores/tab-store';
import { TabBar } from './TabBar';

function addTab(fileName: string) {
  return useTabStore.getState().addTab({
    filePath: `/test/${fileName}`,
    fileName,
    isDirty: false,
    content: '',
    savedContent: '',
  });
}

describe('TabBar', () => {
  beforeEach(() => {
    useTabStore.getState().reset();
  });

  it('should render nothing when no tabs exist', () => {
    const { container } = render(<TabBar />);
    expect(container.querySelector('[data-testid="tab-bar"]')).toBeNull();
  });

  it('should render tabs with filenames', () => {
    addTab('file1.mdx');
    addTab('file2.mdx');

    render(<TabBar />);

    expect(screen.getByText('file1.mdx')).toBeTruthy();
    expect(screen.getByText('file2.mdx')).toBeTruthy();
  });

  it('should highlight the active tab', () => {
    const id1 = addTab('file1.mdx');
    addTab('file2.mdx');

    useTabStore.getState().setActiveTab(id1);

    render(<TabBar />);

    const tab1 = screen.getByTestId(`tab-item-${id1}`);
    expect(tab1.getAttribute('aria-selected')).toBe('true');
  });

  it('should switch active tab on click', () => {
    const id1 = addTab('file1.mdx');
    addTab('file2.mdx');

    render(<TabBar />);

    fireEvent.click(screen.getByTestId(`tab-item-${id1}`));
    expect(useTabStore.getState().activeTabId).toBe(id1);
  });

  it('should close tab when close button is clicked', () => {
    const id1 = addTab('file1.mdx');
    addTab('file2.mdx');

    render(<TabBar />);

    fireEvent.click(screen.getByTestId(`tab-close-${id1}`));
    expect(useTabStore.getState().tabs).toHaveLength(1);
  });

  it('shows when a tab file was deleted', () => {
    const id = addTab('gone.mdx');
    useTabStore.getState().updateTab(id, { fileMissing: true });
    render(<TabBar />);
    expect(screen.getByTestId('missing-indicator').textContent).toBe('Deleted');
  });

  it('should show dirty indicator for dirty tabs', () => {
    const id = addTab('dirty.mdx');
    useTabStore.getState().updateTab(id, { isDirty: true });

    render(<TabBar />);

    expect(screen.getByTestId('dirty-indicator')).toBeTruthy();
  });

  it('should support ArrowLeft/ArrowRight keyboard navigation', () => {
    const id1 = addTab('file1.mdx');
    const id2 = addTab('file2.mdx');

    useTabStore.getState().setActiveTab(id1);
    render(<TabBar />);

    fireEvent.keyDown(screen.getByTestId(`tab-item-${id1}`), { key: 'ArrowRight' });
    expect(useTabStore.getState().activeTabId).toBe(id2);

    fireEvent.keyDown(screen.getByTestId(`tab-item-${id2}`), { key: 'ArrowLeft' });
    expect(useTabStore.getState().activeTabId).toBe(id1);
  });

  it('should support Home/End keyboard navigation', () => {
    const id1 = addTab('file1.mdx');
    addTab('file2.mdx');
    const id3 = addTab('file3.mdx');

    useTabStore.getState().setActiveTab(id3);
    render(<TabBar />);

    fireEvent.keyDown(screen.getByTestId(`tab-item-${id3}`), { key: 'Home' });
    expect(useTabStore.getState().activeTabId).toBe(id1);

    fireEvent.keyDown(screen.getByTestId(`tab-item-${id1}`), { key: 'End' });
    expect(useTabStore.getState().activeTabId).toBe(id3);
  });
});
