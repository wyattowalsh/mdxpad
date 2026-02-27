/**
 * Notification IPC Handlers
 *
 * IPC handlers for system notification operations.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * @module main/ipc/notification-handlers
 */

import type { IpcMain } from 'electron';
import {
  NotificationChannels,
  NotificationRequestSchema,
  type NotificationResponse,
  type PermissionCheckResponse,
  type PermissionRequestResponse,
} from '@shared/contracts/notification-schemas';
import { createValidatedHandler } from '@shared/contracts/file-schemas';
import type { NotificationService } from '@main/services/notification-service';

// ============================================================================
// Request Schemas (for void requests)
// ============================================================================

import { z } from 'zod';

const VoidRequestSchema = z.void();

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Registers all notification IPC handlers.
 *
 * @param ipcMainInstance - The Electron IpcMain instance
 * @param service - The NotificationService instance
 */
export function registerNotificationHandlers(
  ipcMainInstance: IpcMain,
  service: NotificationService
): void {
  // Show notification handler
  const handleShow = createValidatedHandler(
    NotificationRequestSchema,
    async (args): Promise<NotificationResponse> => {
      const result = await service.show(args.title, args.body, {
        icon: args.icon,
        urgency: args.urgency,
        actions: args.actions,
      });

      return {
        id: result.id,
        clicked: result.clicked,
        actionIndex: result.actionIndex,
      };
    }
  );

  // Check permission handler
  const handleCheckPermission = createValidatedHandler(
    VoidRequestSchema,
    (): Promise<PermissionCheckResponse> => {
      return Promise.resolve({
        supported: service.isSupported(),
        granted: service.isSupported(),
      });
    }
  );

  // Request permission handler
  const handleRequestPermission = createValidatedHandler(
    VoidRequestSchema,
    (): Promise<PermissionRequestResponse> => {
      return Promise.resolve({
        granted: service.requestPermission(),
      });
    }
  );

  // Register handlers
  ipcMainInstance.handle(NotificationChannels.SHOW, (_, args) => handleShow(args));

  ipcMainInstance.handle(NotificationChannels.CHECK_PERMISSION, () =>
    handleCheckPermission(undefined)
  );

  ipcMainInstance.handle(NotificationChannels.REQUEST_PERMISSION, () =>
    handleRequestPermission(undefined)
  );

  console.log('[NotificationHandlers] All notification handlers registered');
}
