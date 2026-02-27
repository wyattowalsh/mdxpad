/**
 * NotificationService - Electron system notification wrapper.
 *
 * Provides a managed interface for showing native system notifications
 * with queue management, click handling, and permission checking.
 *
 * Per Constitution Article III.1: Native OS integration owned by main process.
 *
 * @module main/services/notification-service
 */

import { Notification } from 'electron';
import type { NotificationRequest } from '@shared/contracts/notification-schemas';

// ============================================================================
// Types
// ============================================================================

/**
 * Internal notification tracking entry.
 */
interface NotificationEntry {
  readonly id: string;
  readonly notification: Notification;
  readonly resolve: (result: NotificationResult) => void;
}

/**
 * Result of a notification interaction.
 */
export interface NotificationResult {
  readonly id: string;
  readonly clicked: boolean;
  readonly actionIndex?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum notifications in the queue */
const MAX_QUEUE_SIZE = 10;

// ============================================================================
// Service
// ============================================================================

/**
 * Service for managing system notifications.
 *
 * Wraps Electron's Notification API with queue management,
 * click event handling, and unique ID tracking.
 *
 * @example
 * ```typescript
 * const service = new NotificationService();
 *
 * const result = await service.show('File Saved', 'document.mdx saved', {
 *   urgency: 'low',
 * });
 *
 * if (result.clicked) {
 *   console.log('User clicked the notification');
 * }
 * ```
 */
export class NotificationService {
  private readonly activeNotifications = new Map<string, NotificationEntry>();
  private notificationCounter = 0;

  /**
   * Show a system notification.
   *
   * @param title - Notification title
   * @param body - Notification body text
   * @param options - Optional notification configuration
   * @returns Promise resolving to the notification result
   */
  async show(
    title: string,
    body: string,
    options?: Partial<Omit<NotificationRequest, 'title' | 'body'>>
  ): Promise<NotificationResult> {
    // Enforce queue size limit
    if (this.activeNotifications.size >= MAX_QUEUE_SIZE) {
      this.dismissOldest();
    }

    this.notificationCounter += 1;
    const id = `notif-${Date.now()}-${this.notificationCounter}`;

    return new Promise<NotificationResult>((resolve) => {
      const notifOptions: Electron.NotificationConstructorOptions = {
        title,
        body,
        urgency:
          options?.urgency === 'critical'
            ? 'critical'
            : options?.urgency === 'low'
              ? 'low'
              : 'normal',
        silent: false,
      };

      // Only set icon when provided (exactOptionalPropertyTypes)
      if (options?.icon !== undefined) {
        notifOptions.icon = options.icon;
      }

      const notification = new Notification(notifOptions);

      const entry: NotificationEntry = {
        id,
        notification,
        resolve,
      };

      this.activeNotifications.set(id, entry);

      notification.on('click', () => {
        this.activeNotifications.delete(id);
        resolve({ id, clicked: true });
      });

      notification.on('close', () => {
        // Only resolve if not already resolved by click
        if (this.activeNotifications.has(id)) {
          this.activeNotifications.delete(id);
          resolve({ id, clicked: false });
        }
      });

      notification.show();
    });
  }

  /**
   * Check if notifications are supported on this platform.
   *
   * @returns Whether notifications are supported
   */
  isSupported(): boolean {
    return Notification.isSupported();
  }

  /**
   * Request permission to show notifications.
   * On macOS/Electron, notifications are always permitted.
   *
   * @returns Whether permission is granted
   */
  requestPermission(): boolean {
    // Electron on macOS always has notification permission
    return this.isSupported();
  }

  /**
   * Dismiss the oldest active notification.
   */
  private dismissOldest(): void {
    const firstEntry = this.activeNotifications.entries().next();
    if (!firstEntry.done) {
      const [id, entry] = firstEntry.value;
      entry.notification.close();
      this.activeNotifications.delete(id);
      entry.resolve({ id, clicked: false });
    }
  }

  /**
   * Dismiss all active notifications.
   */
  dismissAll(): void {
    for (const [id, entry] of this.activeNotifications) {
      entry.notification.close();
      entry.resolve({ id, clicked: false });
    }
    this.activeNotifications.clear();
  }

  /**
   * Get the number of active notifications.
   *
   * @returns Number of currently shown notifications
   */
  get activeCount(): number {
    return this.activeNotifications.size;
  }
}
