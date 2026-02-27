/**
 * Notification IPC Zod Schemas
 *
 * Contract definitions for system notification functionality.
 * All types validated with zod per Constitution Article III.3.
 *
 * @module contracts/notification-schemas
 */

import { z } from 'zod';

// ============================================================================
// Channel Constants
// ============================================================================

/**
 * IPC channel constants for notification operations.
 */
export const NotificationChannels = {
  SHOW: 'mdxpad:notification:show',
  CHECK_PERMISSION: 'mdxpad:notification:check-permission',
  REQUEST_PERMISSION: 'mdxpad:notification:request-permission',
} as const;

// ============================================================================
// Notification Action Schema
// ============================================================================

/**
 * Notification action button schema.
 */
export const NotificationActionSchema = z.object({
  /** Action identifier */
  id: z.string().min(1),
  /** Display text for the action button */
  label: z.string().min(1),
});

/** Inferred NotificationAction type */
export type NotificationAction = z.infer<typeof NotificationActionSchema>;

// ============================================================================
// Notification Request Schema
// ============================================================================

/**
 * Schema for requesting a system notification.
 */
export const NotificationRequestSchema = z.object({
  /** Notification title */
  title: z.string().min(1),
  /** Notification body text */
  body: z.string(),
  /** Optional icon path or name */
  icon: z.string().optional(),
  /** Urgency level */
  urgency: z.enum(['low', 'normal', 'critical']).optional(),
  /** Action buttons */
  actions: z.array(NotificationActionSchema).optional(),
});

/** Inferred NotificationRequest type */
export type NotificationRequest = z.infer<typeof NotificationRequestSchema>;

// ============================================================================
// Notification Response Schema
// ============================================================================

/**
 * Schema for notification response.
 */
export const NotificationResponseSchema = z.object({
  /** Unique notification identifier */
  id: z.string(),
  /** Whether the notification was clicked */
  clicked: z.boolean(),
  /** Index of clicked action, if any */
  actionIndex: z.number().int().min(0).optional(),
});

/** Inferred NotificationResponse type */
export type NotificationResponse = z.infer<typeof NotificationResponseSchema>;

// ============================================================================
// Permission Schemas
// ============================================================================

/**
 * Schema for permission check response.
 */
export const PermissionCheckResponseSchema = z.object({
  /** Whether notifications are supported on this platform */
  supported: z.boolean(),
  /** Whether the app has permission to show notifications */
  granted: z.boolean(),
});

/** Inferred PermissionCheckResponse type */
export type PermissionCheckResponse = z.infer<typeof PermissionCheckResponseSchema>;

/**
 * Schema for permission request response.
 */
export const PermissionRequestResponseSchema = z.object({
  /** Whether permission was granted */
  granted: z.boolean(),
});

/** Inferred PermissionRequestResponse type */
export type PermissionRequestResponse = z.infer<typeof PermissionRequestResponseSchema>;
