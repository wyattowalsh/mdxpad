import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

import { FrontmatterForm } from '@renderer/components/frontmatter/FrontmatterForm';
import { MarketplacePanel } from '@renderer/components/template-marketplace/MarketplacePanel';
import { ShortcutEditor } from '@renderer/components/shortcuts/ShortcutEditor';
import { useFrontmatterStore } from '@renderer/stores/frontmatter-store';
import { useMarketplaceStore } from '@renderer/stores/marketplace-store';
import { useTemplateStore, selectFilteredTemplates } from '@renderer/stores/template-store';
import { useKeybindingStore } from '@renderer/stores/keybinding-store';

function FilteredTemplates(): React.JSX.Element {
  const templates = useTemplateStore(selectFilteredTemplates);
  return <div>{templates.length}</div>;
}

describe('panels that read derived store lists', () => {
  beforeEach(() => {
    cleanup();
    useMarketplaceStore.getState().reset();
    useKeybindingStore.getState().resetAll();
    useFrontmatterStore.getState().reset();
    useTemplateStore.getState().reset();
  });

  it('opens the template marketplace', async () => {
    render(<MarketplacePanel />);
    expect(screen.getByText('Template Marketplace')).toBeTruthy();
    await waitFor(() => {
      expect(useMarketplaceStore.getState().status).not.toBe('loading');
    });
  });

  it('opens the shortcut editor', () => {
    render(<ShortcutEditor />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
  });

  it('opens the frontmatter form before a document has fields', () => {
    render(<FrontmatterForm />);
    expect(screen.getByText('Add Field')).toBeTruthy();
  });

  it('shows template search results', () => {
    useTemplateStore.getState().setSearchQuery('note');
    render(<FilteredTemplates />);
    expect(screen.getByText('0')).toBeTruthy();
  });
});
