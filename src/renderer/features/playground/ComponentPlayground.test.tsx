import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ComponentPlayground } from './ComponentPlayground';
import { usePlaygroundStore } from './playground-store';

describe('ComponentPlayground', () => {
  beforeEach(() => {
    usePlaygroundStore.getState().reset();
  });

  it('keeps the preview still until refresh when auto is off', () => {
    render(<ComponentPlayground />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Auto' }));
    fireEvent.change(screen.getByPlaceholderText('Enter JSX code...'), {
      target: { value: '<p>Updated preview</p>' },
    });

    expect(screen.getByTestId('playground-preview').textContent).toContain('Hello Playground');
    expect(screen.getByTestId('playground-preview').textContent).not.toContain('Updated preview');

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(screen.getByTestId('playground-preview').textContent).toContain('Updated preview');
  });
});
