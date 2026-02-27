/**
 * Import Operations Preload API.
 * Provides content import bridge functions for the renderer process.
 *
 * @module import-api
 */

import { ipcRenderer } from 'electron';
import { ImportChannels } from '@shared/contracts/import-schemas';

export const importApi = {
  fromHtml: (html: string) => ipcRenderer.invoke(ImportChannels.fromHtml, { html }),

  fromNotion: (pageId: string, apiKey: string) =>
    ipcRenderer.invoke(ImportChannels.fromNotion, { pageId, apiKey }),

  fromGoogleDocs: (docId: string, accessToken: string) =>
    ipcRenderer.invoke(ImportChannels.fromGoogleDocs, { docId, accessToken }),
};
