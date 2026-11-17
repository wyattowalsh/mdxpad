import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { MarketplacePlugin } from '@shared/contracts/plugin-schemas';

import { MarketplacePluginCard } from './PluginCard';

const plugin: MarketplacePlugin = {
  id: 'remote-theme',
  name: 'Remote Theme',
  version: '1.0.0',
  description: 'A theme from a catalog',
  author: 'MDXPad',
  permissions: ['ui'],
  downloads: 0,
};

describe('MarketplacePluginCard', () => {
  it('does not offer remote install', () => {
    render(<MarketplacePluginCard plugin={plugin} isInstalled={false} />);

    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
    expect(screen.getByText('Install unavailable')).toBeDefined();
  });
});
