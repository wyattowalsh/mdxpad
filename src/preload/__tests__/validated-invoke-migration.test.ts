import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GitChannels } from '@shared/contracts/git-schemas';
import { SearchChannels } from '@shared/contracts/search-schemas';
import { ImportChannels } from '@shared/contracts/import-schemas';
import { CitationChannels } from '@shared/contracts/citation-schemas';

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
  },
}));

const mockValidatedInvoke = vi.fn();

vi.mock('../validated-invoke', () => ({
  validatedInvoke: (...args: unknown[]) => mockValidatedInvoke(...args),
}));

import { gitApi } from '../git-api';
import { searchApi } from '../search-api';
import { importApi } from '../import-api';
import { citationApi } from '../citation-api';

describe('validatedInvoke migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidatedInvoke.mockResolvedValue({ ok: true, value: {} });
  });

  it('routes git API through validatedInvoke', async () => {
    await gitApi.status('/repo');
    await gitApi.add('/repo', ['README.md']);
    await gitApi.commit('/repo', 'chore: test');
    await gitApi.log('/repo', 20);
    await gitApi.diff('/repo', true);
    await gitApi.branches('/repo');
    await gitApi.checkout('/repo', 'main');
    await gitApi.isRepo('/repo');

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      GitChannels.status,
      expect.any(Object),
      expect.any(Object),
      { workingDir: '/repo' }
    );
    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      GitChannels.add,
      expect.any(Object),
      expect.any(Object),
      { workingDir: '/repo', files: ['README.md'] }
    );
    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      GitChannels.commit,
      expect.any(Object),
      expect.any(Object),
      { workingDir: '/repo', message: 'chore: test' }
    );
    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      GitChannels.log,
      expect.any(Object),
      expect.any(Object),
      { workingDir: '/repo', maxCount: 20 }
    );
    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      GitChannels.diff,
      expect.any(Object),
      expect.any(Object),
      { workingDir: '/repo', staged: true }
    );
    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      GitChannels.branches,
      expect.any(Object),
      expect.any(Object),
      { workingDir: '/repo' }
    );
    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      GitChannels.checkout,
      expect.any(Object),
      expect.any(Object),
      { workingDir: '/repo', branch: 'main' }
    );
    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      GitChannels.isRepo,
      expect.any(Object),
      expect.any(Object),
      { path: '/repo' }
    );
  });

  it('routes search API through validatedInvoke', async () => {
    await searchApi.search('/workspace', 'query', 25, true);
    await searchApi.index('/workspace', ['.md', '.mdx']);
    await searchApi.status('/workspace');

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      SearchChannels.search,
      expect.any(Object),
      expect.any(Object),
      { workspaceDir: '/workspace', query: 'query', maxResults: 25, fuzzy: true }
    );
    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      SearchChannels.index,
      expect.any(Object),
      expect.any(Object),
      { workspaceDir: '/workspace', fileExtensions: ['.md', '.mdx'] }
    );
    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      SearchChannels.status,
      expect.any(Object),
      expect.any(Object),
      { workspaceDir: '/workspace' }
    );
  });

  it('routes import API through validatedInvoke', async () => {
    await importApi.fromHtml('<h1>Hello</h1>');
    await importApi.fromNotion('page-id', 'secret');
    await importApi.fromGoogleDocs('doc-id', 'token');

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      ImportChannels.fromHtml,
      expect.any(Object),
      expect.any(Object),
      { html: '<h1>Hello</h1>' }
    );
    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      ImportChannels.fromNotion,
      expect.any(Object),
      expect.any(Object),
      { pageId: 'page-id', apiKey: 'secret' }
    );
    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      ImportChannels.fromGoogleDocs,
      expect.any(Object),
      expect.any(Object),
      { docId: 'doc-id', accessToken: 'token' }
    );
  });

  it('routes citation API through validatedInvoke', async () => {
    const entry = { id: 'cite-1', type: 'article' };

    await citationApi.parseBibtex('@article{cite-1,title={Test}}');
    await citationApi.formatCitation(entry, 'apa');
    await citationApi.generateBibliography([entry], 'mla');

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      CitationChannels.parseBibtex,
      expect.any(Object),
      expect.any(Object),
      { bibtex: '@article{cite-1,title={Test}}' }
    );
    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      CitationChannels.formatCitation,
      expect.any(Object),
      expect.any(Object),
      { entry, style: 'apa' }
    );
    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      CitationChannels.generateBibliography,
      expect.any(Object),
      expect.any(Object),
      { entries: [entry], style: 'mla' }
    );
  });
});
