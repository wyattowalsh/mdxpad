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

import type { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/lib/ipc';

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
 */
export function registerTemplateHandlers(ipcMainInstance: IpcMain): void {
  ipcMainInstance.handle(
    IPC_CHANNELS.template.list,
    (_event, payload) => handleTemplateList(payload)
  );

  ipcMainInstance.handle(
    IPC_CHANNELS.template.get,
    (_event, payload) => handleTemplateGet(payload)
  );

  ipcMainInstance.handle(
    IPC_CHANNELS.template.save,
    (_event, payload) => handleTemplateSave(payload)
  );

  ipcMainInstance.handle(
    IPC_CHANNELS.template.delete,
    (_event, payload) => handleTemplateDelete(payload)
  );

  ipcMainInstance.handle(
    IPC_CHANNELS.template.import,
    (_event, payload) => handleTemplateImport(payload)
  );

  ipcMainInstance.handle(
    IPC_CHANNELS.template.export,
    (_event, payload) => handleTemplateExport(payload)
  );

  ipcMainInstance.handle(
    IPC_CHANNELS.template.validate,
    (_event, payload) => handleTemplateValidate(payload)
  );

  ipcMainInstance.handle(
    IPC_CHANNELS.template.createFromTemplate,
    (_event, payload) => handleCreateFromTemplate(payload)
  );

  ipcMainInstance.handle(
    IPC_CHANNELS.template.showOpenDialog,
    (_event, payload) => handleTemplateOpenDialog(payload)
  );

  ipcMainInstance.handle(
    IPC_CHANNELS.template.showSaveDialog,
    (_event, payload) => handleTemplateSaveDialog(payload)
  );

  console.log('[TemplateService] All template handlers registered');
}
