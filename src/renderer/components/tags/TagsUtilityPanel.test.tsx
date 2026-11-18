import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';
import { useTagStore } from '@renderer/stores/tag-store';

import { TagPersistence } from './TagPersistence';
import { TagsUtilityPanel } from './TagsUtilityPanel';

function untitledTab(fileName: string): string {
  return useTabStore.getState().addTab({
    filePath: null,
    fileName,
    isDirty: false,
    content: '',
    savedContent: '',
  });
}

describe('TagsUtilityPanel', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
    useTagStore.getState().reset();
  });

  it('assigns a tag to the open file', () => {
    useDocumentStore.setState({ filePath: '/tmp/note.mdx' });
    const tagId = useTagStore.getState().addTag('alpha', '#6366f1');
    render(<TagsUtilityPanel />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useTagStore.getState().fileTagMap['/tmp/note.mdx']).toEqual([tagId]);

    act(() => {
      useTagStore.getState().toggleSelectedTag(tagId);
    });
    expect(screen.getByRole('button', { name: 'note.mdx' })).toBeTruthy();
  });

  it('asks for an open file before assignment', () => {
    render(<TagsUtilityPanel />);
    expect(screen.getByText('Open a file to assign tags.')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('keeps tags on an untitled tab and moves them when that tab is saved', () => {
    const first = untitledTab('Untitled');
    useDocumentStore.setState({ filePath: null });
    const tagId = useTagStore.getState().addTag('alpha', '#6366f1');
    render(
      <>
        <TagPersistence />
        <TagsUtilityPanel />
      </>
    );
    expect(screen.getByRole('combobox')).toBeTruthy();

    act(() => {
      useTagStore.getState().assignTagToFile(`untitled:${first}`, tagId);
    });

    act(() => {
      useDocumentStore.setState({ filePath: '/tmp/saved.md' });
    });

    expect(useTagStore.getState().fileTagMap['/tmp/saved.md']).toEqual([tagId]);
    expect(useTagStore.getState().fileTagMap[`untitled:${first}`]).toBeUndefined();
  });

  it('does not move one untitled tab tags onto another file', () => {
    const first = untitledTab('Untitled');
    useDocumentStore.setState({ filePath: null });
    const tagId = useTagStore.getState().addTag('alpha', '#6366f1');
    render(<TagPersistence />);

    act(() => {
      useTagStore.getState().assignTagToFile(`untitled:${first}`, tagId);
      useTabStore.getState().addTab({
        filePath: '/tmp/other.md',
        fileName: 'other.md',
        isDirty: false,
        content: '',
        savedContent: '',
      });
      useDocumentStore.setState({ filePath: '/tmp/other.md' });
    });

    expect(useTagStore.getState().fileTagMap[`untitled:${first}`]).toEqual([tagId]);
    expect(useTagStore.getState().fileTagMap['/tmp/other.md']).toBeUndefined();
  });
});
