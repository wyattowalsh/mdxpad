/**
 * Citation IPC handlers.
 * Registers IPC handlers for citation management operations.
 *
 * @module citation-handlers
 */

import type { IpcMain, BrowserWindow } from 'electron';
import {
  CitationChannels,
  ParseBibtexRequestSchema,
  FormatCitationRequestSchema,
  GenerateBibliographyRequestSchema,
} from '@shared/contracts/citation-schemas';
import { assertAuthorizedIpcSender } from '@main/ipc/ipc-sender-authorization';
import { parseBibtex } from './citation-service';
import { formatCitation, generateBibliography } from './citation-formatter';

function handleCitationError(
  error: unknown,
  code = 'UNKNOWN'
): { ok: false; error: { code: string; message: string } } {
  return {
    ok: false,
    error: { code, message: error instanceof Error ? error.message : String(error) },
  };
}

function registerParseHandler(ipcMain: IpcMain, window: BrowserWindow): void {
  ipcMain.handle(CitationChannels.parseBibtex, (event, args) => {
    assertAuthorizedIpcSender(event, window, CitationChannels.parseBibtex);
    try {
      const { bibtex } = ParseBibtexRequestSchema.parse(args);
      return { ok: true, value: parseBibtex(bibtex) };
    } catch (error) {
      return handleCitationError(error, 'PARSE_ERROR');
    }
  });
}

function registerFormatHandlers(ipcMain: IpcMain, window: BrowserWindow): void {
  ipcMain.handle(CitationChannels.formatCitation, (event, args) => {
    assertAuthorizedIpcSender(event, window, CitationChannels.formatCitation);
    try {
      const { entry, style } = FormatCitationRequestSchema.parse(args);
      return { ok: true, value: formatCitation(entry, style) };
    } catch (error) {
      return handleCitationError(error, 'FORMAT_ERROR');
    }
  });

  ipcMain.handle(CitationChannels.generateBibliography, (event, args) => {
    assertAuthorizedIpcSender(event, window, CitationChannels.generateBibliography);
    try {
      const { entries, style } = GenerateBibliographyRequestSchema.parse(args);
      return { ok: true, value: generateBibliography(entries, style) };
    } catch (error) {
      return handleCitationError(error, 'FORMAT_ERROR');
    }
  });
}

export function registerCitationHandlers(ipcMain: IpcMain, window: BrowserWindow): void {
  registerParseHandler(ipcMain, window);
  registerFormatHandlers(ipcMain, window);
  console.log('[CitationHandlers] All citation handlers registered');
}
