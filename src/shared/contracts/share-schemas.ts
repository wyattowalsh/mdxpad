/**
 * Share & Publish IPC contract schemas.
 * Zod schemas for validating all share/publish IPC channel payloads.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * @module shared/contracts/share-schemas
 */

import { z } from 'zod';

// ============================================================================
// Share Link Schemas
// ============================================================================

/**
 * Share link access mode.
 */
export const ShareAccessModeSchema = z.enum(['read-only', 'read-write']);

/** Inferred ShareAccessMode type */
export type ShareAccessMode = z.infer<typeof ShareAccessModeSchema>;

/**
 * Share link schema.
 * Represents a generated share link with metadata.
 */
export const ShareLinkSchema = z.object({
  id: z.string().uuid(),
  token: z.string().min(16),
  docId: z.string().min(1),
  url: z.string().url(),
  accessMode: ShareAccessModeSchema,
  createdAt: z.number(),
  expiresAt: z.number().nullable(),
  isActive: z.boolean(),
});

/** Inferred ShareLink type */
export type ShareLink = z.infer<typeof ShareLinkSchema>;

/**
 * Share config schema.
 * Configuration for creating a share link.
 */
export const ShareConfigSchema = z.object({
  docId: z.string().min(1),
  accessMode: ShareAccessModeSchema,
  expiresInMs: z.number().int().positive().nullable(),
});

/** Inferred ShareConfig type */
export type ShareConfig = z.infer<typeof ShareConfigSchema>;

// ============================================================================
// Publish Schemas
// ============================================================================

/**
 * Publish file entry schema.
 * Represents a file to include in the static site.
 */
export const PublishFileEntrySchema = z.object({
  path: z.string().min(1),
  title: z.string().optional(),
});

/** Inferred PublishFileEntry type */
export type PublishFileEntry = z.infer<typeof PublishFileEntrySchema>;

/**
 * Publish config schema.
 * Configuration for static site generation.
 */
export const PublishConfigSchema = z.object({
  files: z.array(PublishFileEntrySchema).min(1),
  outputDir: z.string().min(1),
  title: z.string().optional(),
  includeStyles: z.boolean(),
  includeHighlighting: z.boolean(),
  generateIndex: z.boolean(),
});

/** Inferred PublishConfig type */
export type PublishConfig = z.infer<typeof PublishConfigSchema>;

/**
 * Publish progress event schema.
 */
export const PublishProgressSchema = z.object({
  totalFiles: z.number().int().nonnegative(),
  processedFiles: z.number().int().nonnegative(),
  currentFile: z.string().nullable(),
  status: z.enum(['pending', 'processing', 'complete', 'error']),
  error: z.string().nullable(),
});

/** Inferred PublishProgress type */
export type PublishProgress = z.infer<typeof PublishProgressSchema>;

/**
 * Publish result schema.
 */
export const PublishResultSchema = z.object({
  success: z.boolean(),
  outputDir: z.string(),
  filesGenerated: z.number().int().nonnegative(),
  indexPath: z.string().nullable(),
  errors: z.array(z.string()),
});

/** Inferred PublishResult type */
export type PublishResult = z.infer<typeof PublishResultSchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Create share link request.
 */
export const CreateShareLinkRequestSchema = ShareConfigSchema;

/** Inferred CreateShareLinkRequest type */
export type CreateShareLinkRequest = z.infer<typeof CreateShareLinkRequestSchema>;

/**
 * Create share link response.
 */
export const CreateShareLinkResponseSchema = z.object({
  success: z.literal(true),
  link: ShareLinkSchema,
});

/** Inferred CreateShareLinkResponse type */
export type CreateShareLinkResponse = z.infer<typeof CreateShareLinkResponseSchema>;

/**
 * Revoke share link request.
 */
export const RevokeShareLinkRequestSchema = z.object({
  id: z.string().uuid(),
});

/** Inferred RevokeShareLinkRequest type */
export type RevokeShareLinkRequest = z.infer<typeof RevokeShareLinkRequestSchema>;

/**
 * Revoke share link response.
 */
export const RevokeShareLinkResponseSchema = z.object({
  success: z.literal(true),
});

/** Inferred RevokeShareLinkResponse type */
export type RevokeShareLinkResponse = z.infer<typeof RevokeShareLinkResponseSchema>;

/**
 * Get share links request.
 */
export const GetShareLinksRequestSchema = z.object({
  docId: z.string().min(1).optional(),
});

/** Inferred GetShareLinksRequest type */
export type GetShareLinksRequest = z.infer<typeof GetShareLinksRequestSchema>;

/**
 * Get share links response.
 */
export const GetShareLinksResponseSchema = z.object({
  links: z.array(ShareLinkSchema),
});

/** Inferred GetShareLinksResponse type */
export type GetShareLinksResponse = z.infer<typeof GetShareLinksResponseSchema>;

/**
 * Publish request.
 */
export const PublishRequestSchema = PublishConfigSchema;

/** Inferred PublishRequest type */
export type PublishRequest = z.infer<typeof PublishRequestSchema>;

/**
 * Publish response.
 */
export const PublishResponseSchema = PublishResultSchema;

/** Inferred PublishResponse type */
export type PublishResponse = z.infer<typeof PublishResponseSchema>;

// ============================================================================
// Channel Constants
// ============================================================================

/**
 * Share & Publish IPC channel constants.
 * All channels follow mdxpad:{domain}:{action} naming convention.
 */
export const ShareChannels = {
  CREATE_LINK: 'mdxpad:share:create-link',
  REVOKE_LINK: 'mdxpad:share:revoke-link',
  GET_LINKS: 'mdxpad:share:get-links',
  PUBLISH: 'mdxpad:share:publish',
  PUBLISH_PROGRESS: 'mdxpad:share:publish-progress',
} as const;

/** Union of all share channel names */
export type ShareChannel = (typeof ShareChannels)[keyof typeof ShareChannels];
