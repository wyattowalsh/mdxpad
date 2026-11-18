import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SaveTemplateDialog } from './SaveTemplateDialog';

describe('SaveTemplateDialog', () => {
  it('saves the document that was open when the dialog opened', () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <SaveTemplateDialog
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        content="# Document A"
        existingNames={[]}
      />
    );

    rerender(
      <SaveTemplateDialog
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        content="# Document B"
        existingNames={[]}
      />
    );

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Notes' } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'A note' } });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Select category' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Blog Posts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Template' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Notes',
        content: '# Document A',
      })
    );
  });
});
