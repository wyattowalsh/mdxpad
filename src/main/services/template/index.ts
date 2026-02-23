/**
 * Template Service - Main Process
 *
 * Feature: 016-template-library
 * Phase: 3 - Implementation
 *
 * Handles all file I/O for templates:
 * - Load templates from bundled resources and user directory
 * - Save/delete custom templates
 * - Import/export templates
 * - Validate MDX content
 *
 * @module template-service
 * @see Constitution §III.3 - All payloads validated with zod safeParse()
 */

import type { IpcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/lib/ipc';
import { assertAuthorizedIpcSender } from '@main/ipc/ipc-sender-authorization';

import {
  handleTemplateList,
  handleTemplateGet,
  handleTemplateSave,
  handleTemplateDelete,
  handleTemplateImport,
  handleTemplateExport,
  handleTemplateValidate,
  handleCreateFromTemplate,
  handleTemplateOpenDialog,
  handleTemplateSaveDialog,
} from './handlers';

// Re-export for direct access
export * from './paths';
export * from './errors';
export * from './parser';
export * from './loader';
export * from './handlers';

/**
 * Registers all template IPC handlers.
 * Called during app initialization.
 *
 * @param ipcMainInstance - The Electron IpcMain instance
 * @param window - BrowserWindow used for sender/frame authorization
 */
function registerAuthorizedTemplateHandler(
  ipcMainInstance: IpcMain,
  window: BrowserWindow,
  channel: string,
  handler: (payload: unknown) => Promise<unknown>
): void {
  ipcMainInstance.handle(channel, (event, payload) => {
    assertAuthorizedIpcSender(event, window, channel);
    return handler(payload);
  });
}

type TemplateHandlerRegistration = readonly [
  channel: string,
  handler: (payload: unknown) => Promise<unknown>,
];

export function registerTemplateHandlers(
  ipcMainInstance: IpcMain,
  window: BrowserWindow
): void {
  const registrations: TemplateHandlerRegistration[] = [
    [IPC_CHANNELS.template.list, handleTemplateList],
    [IPC_CHANNELS.template.get, handleTemplateGet],
    [IPC_CHANNELS.template.save, handleTemplateSave],
    [IPC_CHANNELS.template.delete, handleTemplateDelete],
    [IPC_CHANNELS.template.import, handleTemplateImport],
    [IPC_CHANNELS.template.export, handleTemplateExport],
    [IPC_CHANNELS.template.validate, handleTemplateValidate],
    [IPC_CHANNELS.template.createFromTemplate, handleCreateFromTemplate],
    [IPC_CHANNELS.template.showOpenDialog, handleTemplateOpenDialog],
    [IPC_CHANNELS.template.showSaveDialog, handleTemplateSaveDialog],
  ];

  for (const [channel, handler] of registrations) {
    registerAuthorizedTemplateHandler(ipcMainInstance, window, channel, handler);
  }

  console.log('[TemplateService] All template handlers registered');
}
