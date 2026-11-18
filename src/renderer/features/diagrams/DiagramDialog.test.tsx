import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { useDocumentStore } from '@renderer/stores/document-store';
import { DiagramDialog } from './DiagramDialog';
import { useDiagramStore } from './diagram-store';

describe('DiagramDialog', () => {
  beforeEach(() => {
    cleanup();
    useDocumentStore.getState().reset();
    useDiagramStore.getState().reset();
  });

  it('inserts a diagram into the file it was generated for', () => {
    useDocumentStore.setState({ content: 'Hello', filePath: '/notes/a.md' });
    useDiagramStore.setState({
      mermaidCode: 'graph TD; A-->B',
      status: 'success',
      documentKey: '/notes/a.md',
    });
    const onInsert = vi.fn();

    render(<DiagramDialog isOpen onClose={() => undefined} onInsert={onInsert} />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert into Document' }));

    expect(onInsert).toHaveBeenCalledWith('```mermaid\ngraph TD; A-->B\n```');
  });

  it('hides a diagram that belongs to another file', () => {
    useDocumentStore.setState({ content: 'Hello', filePath: '/notes/a.md' });
    useDiagramStore.setState({
      mermaidCode: 'graph TD; A-->B',
      status: 'success',
      documentKey: '/notes/a.md',
    });
    const onInsert = vi.fn();

    render(<DiagramDialog isOpen onClose={() => undefined} onInsert={onInsert} />);
    act(() => {
      useDocumentStore.setState({ content: 'Other', filePath: '/notes/b.md' });
    });

    expect(screen.queryByRole('button', { name: 'Insert into Document' })).toBeNull();
    expect(onInsert).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().content).toBe('Other');
  });
});
