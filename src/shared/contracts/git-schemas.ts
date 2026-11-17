/**
 * Git IPC contract schemas.
 * Zod schemas for validating all git operation IPC payloads.
 *
 * @module git-schemas
 */

import { z } from 'zod';

// ============================================================================
// Channel Definitions
// ============================================================================

export const GitChannels = {
  status: 'mdxpad:git:status',
  add: 'mdxpad:git:add',
  commit: 'mdxpad:git:commit',
  log: 'mdxpad:git:log',
  diff: 'mdxpad:git:diff',
  branches: 'mdxpad:git:branches',
  checkout: 'mdxpad:git:checkout',
  isRepo: 'mdxpad:git:is-repo',
} as const;

// ============================================================================
// Request Schemas
// ============================================================================

export const GitStatusRequestSchema = z.object({
  workingDir: z.string().min(1),
});

export const GitAddRequestSchema = z.object({
  workingDir: z.string().min(1),
  files: z.array(z.string().min(1)).min(1),
});

export const GitCommitRequestSchema = z.object({
  workingDir: z.string().min(1),
  message: z.string().min(1),
  files: z.array(z.string().min(1)).min(1).optional(),
});

export const GitLogRequestSchema = z.object({
  workingDir: z.string().min(1),
  maxCount: z.number().int().positive().optional(),
});

export const GitDiffRequestSchema = z.object({
  workingDir: z.string().min(1),
  staged: z.boolean().optional(),
});

export const GitBranchesRequestSchema = z.object({
  workingDir: z.string().min(1),
});

export const GitCheckoutRequestSchema = z.object({
  workingDir: z.string().min(1),
  branch: z.string().min(1),
});

export const GitIsRepoRequestSchema = z.object({
  path: z.string().min(1),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const GitFileStatusSchema = z.object({
  path: z.string(),
  index: z.string(),
  workingDir: z.string(),
});

export const GitStatusResponseSchema = z.object({
  isClean: z.boolean(),
  staged: z.array(z.string()),
  modified: z.array(z.string()),
  notAdded: z.array(z.string()),
  created: z.array(z.string()),
  deleted: z.array(z.string()),
  conflicted: z.array(z.string()),
  current: z.string().nullable(),
  tracking: z.string().nullable(),
});

export const GitAddResponseSchema = z.object({
  success: z.boolean(),
});

export const GitCommitResponseSchema = z.object({
  hash: z.string(),
  message: z.string(),
});

export const GitLogEntrySchema = z.object({
  hash: z.string(),
  date: z.string(),
  message: z.string(),
  author: z.string(),
});

export const GitLogResponseSchema = z.object({
  entries: z.array(GitLogEntrySchema),
  total: z.number(),
});

export const GitDiffResponseSchema = z.object({
  diff: z.string(),
  filesChanged: z.number(),
});

export const GitBranchSchema = z.object({
  name: z.string(),
  current: z.boolean(),
});

export const GitBranchesResponseSchema = z.object({
  branches: z.array(GitBranchSchema),
  current: z.string(),
});

export const GitCheckoutResponseSchema = z.object({
  success: z.boolean(),
  branch: z.string(),
});

export const GitIsRepoResponseSchema = z.object({
  isRepo: z.boolean(),
});

// ============================================================================
// Error Schema
// ============================================================================

export const GitErrorSchema = z.object({
  code: z.enum(['NOT_GIT_REPO', 'BRANCH_NOT_FOUND', 'MERGE_CONFLICT', 'UNKNOWN']),
  message: z.string(),
});

export type GitError = z.infer<typeof GitErrorSchema>;

// ============================================================================
// Type Exports
// ============================================================================

export type GitStatusRequest = z.infer<typeof GitStatusRequestSchema>;
export type GitStatusResponse = z.infer<typeof GitStatusResponseSchema>;
export type GitAddRequest = z.infer<typeof GitAddRequestSchema>;
export type GitAddResponse = z.infer<typeof GitAddResponseSchema>;
export type GitCommitRequest = z.infer<typeof GitCommitRequestSchema>;
export type GitCommitResponse = z.infer<typeof GitCommitResponseSchema>;
export type GitLogRequest = z.infer<typeof GitLogRequestSchema>;
export type GitLogResponse = z.infer<typeof GitLogResponseSchema>;
export type GitLogEntry = z.infer<typeof GitLogEntrySchema>;
export type GitDiffRequest = z.infer<typeof GitDiffRequestSchema>;
export type GitDiffResponse = z.infer<typeof GitDiffResponseSchema>;
export type GitBranchesRequest = z.infer<typeof GitBranchesRequestSchema>;
export type GitBranchesResponse = z.infer<typeof GitBranchesResponseSchema>;
export type GitBranch = z.infer<typeof GitBranchSchema>;
export type GitCheckoutRequest = z.infer<typeof GitCheckoutRequestSchema>;
export type GitCheckoutResponse = z.infer<typeof GitCheckoutResponseSchema>;
export type GitIsRepoRequest = z.infer<typeof GitIsRepoRequestSchema>;
export type GitIsRepoResponse = z.infer<typeof GitIsRepoResponseSchema>;
