import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import { useTagStore } from '@renderer/stores/tag-store';

import { TagsUtilityPanel } from './TagsUtilityPanel';

describe('TagsUtilityPanel', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
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
});
