import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagPicker } from './TagPicker';
import { useTagStore } from '../../stores/tag-store';

describe('TagPicker', () => {
  beforeEach(() => {
    useTagStore.getState().reset();
  });

  it('exposes combobox and listbox ARIA semantics', () => {
    useTagStore.getState().addTag('alpha', '#6366f1');
    render(<TagPicker filePath="/tmp/doc.mdx" />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    expect(input.getAttribute('aria-expanded')).toBe('true');
    const listboxId = input.getAttribute('aria-controls');
    expect(listboxId).toBeTruthy();
    expect(document.getElementById(listboxId!)?.getAttribute('role')).toBe('listbox');
  });

  it('supports keyboard selection for existing tags', () => {
    const tagId = useTagStore.getState().addTag('alpha', '#6366f1');
    render(<TagPicker filePath="/tmp/doc.mdx" />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useTagStore.getState().fileTagMap['/tmp/doc.mdx']).toEqual([tagId]);
  });
});
