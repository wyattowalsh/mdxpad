/**
 * Tests for PublishWebPanel component.
 * Smoke render tests for the publish panel.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PublishWebPanel, type PublishFileItem } from './PublishWebPanel';

function createMockFile(overrides?: Partial<PublishFileItem>): PublishFileItem {
  return {
    path: '/docs/file.mdx',
    name: 'file.mdx',
    selected: true,
    ...overrides,
  };
}

describe('PublishWebPanel', () => {
  const defaultProps = {
    outputDir: '/output',
    progress: null,
    isPublishing: false,
    lastResult: null,
    onToggleFile: vi.fn(),
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
    onChooseOutputDir: vi.fn(),
    onPublish: vi.fn(),
    onOpenOutput: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<PublishWebPanel files={[]} {...defaultProps} />);
    expect(screen.getByTestId('publish-web-panel')).toBeDefined();
  });

  it('renders file list', () => {
    const files = [
      createMockFile({ path: '/a.mdx', name: 'a.mdx' }),
      createMockFile({ path: '/b.mdx', name: 'b.mdx' }),
    ];
    render(<PublishWebPanel files={files} {...defaultProps} />);
    expect(screen.getByText('a.mdx')).toBeDefined();
    expect(screen.getByText('b.mdx')).toBeDefined();
  });

  it('shows selected file count', () => {
    const files = [
      createMockFile({ selected: true }),
      createMockFile({ path: '/b.mdx', name: 'b.mdx', selected: false }),
    ];
    render(<PublishWebPanel files={files} {...defaultProps} />);
    expect(screen.getByText('Files (1/2)')).toBeDefined();
  });

  it('calls onPublish when publish button clicked', () => {
    const onPublish = vi.fn();
    render(<PublishWebPanel files={[createMockFile()]} {...defaultProps} onPublish={onPublish} />);
    fireEvent.click(screen.getByText('Publish 1 file'));
    expect(onPublish).toHaveBeenCalledWith({ includeStyles: true, generateIndex: true });
  });

  it('sends unchecked publish options', () => {
    const onPublish = vi.fn();
    render(<PublishWebPanel files={[createMockFile()]} {...defaultProps} onPublish={onPublish} />);
    fireEvent.click(screen.getByLabelText('Generate index page'));
    fireEvent.click(screen.getByLabelText('Include styles'));
    fireEvent.click(screen.getByText('Publish 1 file'));
    expect(onPublish).toHaveBeenCalledWith({ includeStyles: false, generateIndex: false });
  });

  it('disables publish button when no files selected', () => {
    render(<PublishWebPanel files={[createMockFile({ selected: false })]} {...defaultProps} />);
    const btn = screen.getByText('Publish 0 files');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows progress bar when publishing', () => {
    render(
      <PublishWebPanel
        files={[createMockFile()]}
        {...defaultProps}
        isPublishing={true}
        progress={{
          totalFiles: 3,
          processedFiles: 1,
          currentFile: 'test.mdx',
          status: 'processing',
          error: null,
        }}
      />
    );
    expect(screen.getByTestId('publish-progress')).toBeDefined();
    expect(screen.getByText(/Processing: test\.mdx/)).toBeDefined();
  });

  it('shows success result', () => {
    render(
      <PublishWebPanel
        files={[createMockFile()]}
        {...defaultProps}
        lastResult={{ success: true, filesGenerated: 3, errors: [] }}
      />
    );
    expect(screen.getByTestId('publish-result')).toBeDefined();
    expect(screen.getByText('Generated 3 file(s)')).toBeDefined();
  });

  it('shows error result', () => {
    render(
      <PublishWebPanel
        files={[createMockFile()]}
        {...defaultProps}
        lastResult={{ success: false, filesGenerated: 0, errors: ['File not found'] }}
      />
    );
    expect(screen.getByText('Publishing failed')).toBeDefined();
    expect(screen.getByText('File not found')).toBeDefined();
  });
});
