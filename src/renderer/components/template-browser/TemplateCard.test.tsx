import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateCard } from './TemplateCard';
import type { TemplateMetadata } from '@shared/contracts/template-schemas';

const template: TemplateMetadata = {
  id: 'template-1',
  name: 'Meeting Notes',
  description: 'Capture meeting outcomes',
  category: 'notes',
  tags: ['team'],
  isBuiltIn: false,
};

describe('TemplateCard', () => {
  it('uses option semantics for listbox compatibility', () => {
    render(<TemplateCard template={template} isSelected={true} onSelect={vi.fn()} />);

    const option = screen.getByRole('option', { name: /meeting notes/i });
    expect(option.getAttribute('aria-selected')).toBe('true');
    expect(option.getAttribute('id')).toBe('template-option-template-1');
  });

  it('supports keyboard selection with Enter', () => {
    const onSelect = vi.fn();
    render(<TemplateCard template={template} isSelected={false} onSelect={onSelect} />);

    const option = screen.getByRole('option', { name: /meeting notes/i });
    fireEvent.keyDown(option, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('template-1');
  });
});
