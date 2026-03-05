/**
 * Git Operations Preload API.
 * Provides git operation bridge functions for the renderer process.
 *
 * @module git-api
 */

import { z } from 'zod';
import {
  GitChannels,
  GitStatusRequestSchema,
  GitAddRequestSchema,
  GitCommitRequestSchema,
  GitLogRequestSchema,
  GitDiffRequestSchema,
  GitBranchesRequestSchema,
  GitCheckoutRequestSchema,
  GitIsRepoRequestSchema,
  GitStatusResponseSchema,
  GitAddResponseSchema,
  GitCommitResponseSchema,
  GitLogResponseSchema,
  GitDiffResponseSchema,
  GitBranchesResponseSchema,
  GitCheckoutResponseSchema,
  GitIsRepoResponseSchema,
  GitErrorSchema,
} from '@shared/contracts/git-schemas';
import { validatedInvoke } from './validated-invoke';

const createGitOperationResultSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value: valueSchema }),
    z.object({ ok: z.literal(false), error: GitErrorSchema }),
  ]);

const GitStatusResultSchema = createGitOperationResultSchema(GitStatusResponseSchema);
const GitAddResultSchema = createGitOperationResultSchema(GitAddResponseSchema);
const GitCommitResultSchema = createGitOperationResultSchema(GitCommitResponseSchema);
const GitLogResultSchema = createGitOperationResultSchema(GitLogResponseSchema);
const GitDiffResultSchema = createGitOperationResultSchema(GitDiffResponseSchema);
const GitBranchesResultSchema = createGitOperationResultSchema(GitBranchesResponseSchema);
const GitCheckoutResultSchema = createGitOperationResultSchema(GitCheckoutResponseSchema);
const GitIsRepoResultSchema = createGitOperationResultSchema(GitIsRepoResponseSchema);

export const gitApi = {
  status: (workingDir: string) =>
    validatedInvoke(GitChannels.status, GitStatusRequestSchema, GitStatusResultSchema, {
      workingDir,
    }),

  add: (workingDir: string, files: string[]) =>
    validatedInvoke(GitChannels.add, GitAddRequestSchema, GitAddResultSchema, {
      workingDir,
      files,
    }),

  commit: (workingDir: string, message: string) =>
    validatedInvoke(GitChannels.commit, GitCommitRequestSchema, GitCommitResultSchema, {
      workingDir,
      message,
    }),

  log: (workingDir: string, maxCount?: number) =>
    validatedInvoke(GitChannels.log, GitLogRequestSchema, GitLogResultSchema, {
      workingDir,
      ...(maxCount !== undefined && { maxCount }),
    }),

  diff: (workingDir: string, staged?: boolean) =>
    validatedInvoke(GitChannels.diff, GitDiffRequestSchema, GitDiffResultSchema, {
      workingDir,
      ...(staged !== undefined && { staged }),
    }),

  branches: (workingDir: string) =>
    validatedInvoke(GitChannels.branches, GitBranchesRequestSchema, GitBranchesResultSchema, {
      workingDir,
    }),

  checkout: (workingDir: string, branch: string) =>
    validatedInvoke(GitChannels.checkout, GitCheckoutRequestSchema, GitCheckoutResultSchema, {
      workingDir,
      branch,
    }),

  isRepo: (path: string) =>
    validatedInvoke(GitChannels.isRepo, GitIsRepoRequestSchema, GitIsRepoResultSchema, { path }),
};
