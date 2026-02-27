/**
 * Notification Preload API
 *
 * Provides the notification API surface exposed to renderer via contextBridge.
 * All methods use IPC invoke/handle pattern with zod validation.
 *
 * @module preload/notification-api
 */

import { ipcRenderer } from 'electron';
import {
  NotificationChannels,
  NotificationRequestSchema,
  NotificationResponseSchema,
  PermissionCheckResponseSchema,
  PermissionRequestResponseSchema,
  type NotificationRequest,
  type NotificationResponse,
  type PermissionCheckResponse,
  type PermissionRequestResponse,
} from '@shared/contracts/notification-schemas';

// ============================================================================
// Types
// ============================================================================

/**
 * Notification API exposed to renderer process.
 */
export interface NotificationApi {
  /**
   * Show a system notification.
   * @param request - Notification configuration
   * @returns Notification response with click status
   */
  readonly show: (request: NotificationRequest) => Promise<NotificationResponse>;

  /**
   * Check if notifications are supported.
   * @returns Permission check response
   */
  readonly isSupported: () => Promise<PermissionCheckResponse>;

  /**
   * Request permission to show notifications.
   * @returns Permission request response
   */
  readonly requestPermission: () => Promise<PermissionRequestResponse>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Notification API implementation for preload context.
 */
export const notificationApi: NotificationApi = {
  show: async (request) => {
    // Validate request before sending
    const parsed = NotificationRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw new Error(`Invalid notification request: ${parsed.error.message}`);
    }

    const response: unknown = await ipcRenderer.invoke(NotificationChannels.SHOW, parsed.data);

    const responseParsed = NotificationResponseSchema.safeParse(response);
    if (!responseParsed.success) {
      throw new Error(`Invalid notification response: ${responseParsed.error.message}`);
    }

    return responseParsed.data;
  },

  isSupported: async () => {
    const response: unknown = await ipcRenderer.invoke(NotificationChannels.CHECK_PERMISSION);

    const parsed = PermissionCheckResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw new Error(`Invalid permission check response: ${parsed.error.message}`);
    }

    return parsed.data;
  },

  requestPermission: async () => {
    const response: unknown = await ipcRenderer.invoke(NotificationChannels.REQUEST_PERMISSION);

    const parsed = PermissionRequestResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw new Error(`Invalid permission request response: ${parsed.error.message}`);
    }

    return parsed.data;
  },
};
