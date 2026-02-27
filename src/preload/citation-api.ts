/**
 * Citation Operations Preload API.
 * Provides citation management bridge functions for the renderer process.
 *
 * @module citation-api
 */

import { ipcRenderer } from 'electron';
import { CitationChannels } from '@shared/contracts/citation-schemas';
import type { CitationEntry, CitationStyle } from '@shared/contracts/citation-schemas';

export const citationApi = {
  parseBibtex: (bibtex: string) => ipcRenderer.invoke(CitationChannels.parseBibtex, { bibtex }),

  formatCitation: (entry: CitationEntry, style: CitationStyle) =>
    ipcRenderer.invoke(CitationChannels.formatCitation, { entry, style }),

  generateBibliography: (entries: CitationEntry[], style: CitationStyle) =>
    ipcRenderer.invoke(CitationChannels.generateBibliography, { entries, style }),
};
