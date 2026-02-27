/**
 * Collaboration IPC contract schemas.
 * Zod schemas for validating all collaboration IPC channel payloads.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * @module shared/contracts/collab-schemas
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * User color schema — hex color string.
 */
export const UserColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/**
 * Connection status enum schema.
 */
export const CollabConnectionStatusSchema = z.enum([
  'disconnected',
  'connecting',
  'connected',
  'error',
]);

/** Inferred connection status type */
export type CollabConnectionStatus = z.infer<typeof CollabConnectionStatusSchema>;

// ============================================================================
// Peer Schema
// ============================================================================

/**
 * Collaboration peer schema.
 * Represents a connected user in a room.
 */
export const CollabPeerSchema = z.object({
  clientId: z.number(),
  username: z.string().min(1),
  color: UserColorSchema,
  cursorLine: z.number().int().nonnegative().optional(),
  cursorColumn: z.number().int().nonnegative().optional(),
  selectionFrom: z.number().int().nonnegative().optional(),
  selectionTo: z.number().int().nonnegative().optional(),
  lastActive: z.number(),
});

/** Inferred CollabPeer type */
export type CollabPeer = z.infer<typeof CollabPeerSchema>;

// ============================================================================
// Room Schema
// ============================================================================

/**
 * Collaboration room schema.
 * Represents an active collaboration session for a document.
 */
export const CollabRoomSchema = z.object({
  roomId: z.string().min(1),
  docId: z.string().min(1),
  peers: z.array(CollabPeerSchema),
  createdAt: z.number(),
});

/** Inferred CollabRoom type */
export type CollabRoom = z.infer<typeof CollabRoomSchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Join room request schema.
 */
export const CollabJoinRequestSchema = z.object({
  docId: z.string().min(1),
  username: z.string().min(1),
  color: UserColorSchema.optional(),
});

/** Inferred CollabJoinRequest type */
export type CollabJoinRequest = z.infer<typeof CollabJoinRequestSchema>;

/**
 * Join room response schema.
 */
export const CollabJoinResponseSchema = z.object({
  success: z.literal(true),
  roomId: z.string().min(1),
  port: z.number().int().positive(),
  peers: z.array(CollabPeerSchema),
});

/** Inferred CollabJoinResponse type */
export type CollabJoinResponse = z.infer<typeof CollabJoinResponseSchema>;

/**
 * Leave room request schema.
 */
export const CollabLeaveRequestSchema = z.object({
  roomId: z.string().min(1),
});

/** Inferred CollabLeaveRequest type */
export type CollabLeaveRequest = z.infer<typeof CollabLeaveRequestSchema>;

/**
 * Leave room response schema.
 */
export const CollabLeaveResponseSchema = z.object({
  success: z.literal(true),
});

/** Inferred CollabLeaveResponse type */
export type CollabLeaveResponse = z.infer<typeof CollabLeaveResponseSchema>;

/**
 * Room status request schema.
 */
export const CollabStatusRequestSchema = z.object({
  roomId: z.string().min(1),
});

/** Inferred CollabStatusRequest type */
export type CollabStatusRequest = z.infer<typeof CollabStatusRequestSchema>;

/**
 * Room status response schema.
 */
export const CollabStatusResponseSchema = z.object({
  status: CollabConnectionStatusSchema,
  roomId: z.string().min(1).nullable(),
  peers: z.array(CollabPeerSchema),
  port: z.number().int().positive().nullable(),
});

/** Inferred CollabStatusResponse type */
export type CollabStatusResponse = z.infer<typeof CollabStatusResponseSchema>;

/**
 * Peer update event schema (main -> renderer).
 */
export const CollabPeerUpdateEventSchema = z.object({
  roomId: z.string().min(1),
  peers: z.array(CollabPeerSchema),
});

/** Inferred CollabPeerUpdateEvent type */
export type CollabPeerUpdateEvent = z.infer<typeof CollabPeerUpdateEventSchema>;

// ============================================================================
// Channel Constants
// ============================================================================

/**
 * Collaboration IPC channel constants.
 * All channels follow mdxpad:{domain}:{action} naming convention.
 */
export const CollabChannels = {
  JOIN: 'mdxpad:collab:join',
  LEAVE: 'mdxpad:collab:leave',
  STATUS: 'mdxpad:collab:status',
  PEER_UPDATE: 'mdxpad:collab:peer-update',
  CONNECTION_CHANGE: 'mdxpad:collab:connection-change',
} as const;

/** Union of all collab channel names */
export type CollabChannel = (typeof CollabChannels)[keyof typeof CollabChannels];
