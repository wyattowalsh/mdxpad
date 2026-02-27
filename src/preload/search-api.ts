/**
 * Search Operations Preload API.
 * Provides search bridge functions for the renderer process.
 *
 * @module search-api
 */

import { ipcRenderer } from 'electron';
import { SearchChannels } from '@shared/contracts/search-schemas';

export const searchApi = {
  search: (workspaceDir: string, query: string, maxResults?: number, fuzzy?: boolean) =>
    ipcRenderer.invoke(SearchChannels.search, { query, workspaceDir, maxResults, fuzzy }),

  index: (workspaceDir: string, fileExtensions?: string[]) =>
    ipcRenderer.invoke(SearchChannels.index, { workspaceDir, fileExtensions }),

  status: (workspaceDir: string) => ipcRenderer.invoke(SearchChannels.status, { workspaceDir }),
};
