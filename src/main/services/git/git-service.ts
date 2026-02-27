/**
 * Git operations service.
 * Wraps simple-git with proper error handling for workspace git operations.
 *
 * @module git-service
 */

import simpleGit, { type SimpleGit, type StatusResult, type LogResult } from 'simple-git';
import type {
  GitStatusResponse,
  GitCommitResponse,
  GitLogResponse,
  GitDiffResponse,
  GitBranchesResponse,
  GitCheckoutResponse,
} from '@shared/contracts/git-schemas';

export class GitServiceError extends Error {
  readonly code: 'NOT_GIT_REPO' | 'BRANCH_NOT_FOUND' | 'MERGE_CONFLICT' | 'UNKNOWN';

  constructor(
    message: string,
    code: 'NOT_GIT_REPO' | 'BRANCH_NOT_FOUND' | 'MERGE_CONFLICT' | 'UNKNOWN' = 'UNKNOWN'
  ) {
    super(message);
    this.name = 'GitServiceError';
    this.code = code;
  }
}

function createGitInstance(workingDir: string): SimpleGit {
  return simpleGit({ baseDir: workingDir, binary: 'git', maxConcurrentProcesses: 6 });
}

function mapStatusResult(status: StatusResult): GitStatusResponse {
  return {
    isClean: status.isClean(),
    staged: status.staged,
    modified: status.modified,
    notAdded: status.not_added,
    created: status.created,
    deleted: status.deleted,
    conflicted: status.conflicted,
    current: status.current ?? null,
    tracking: status.tracking ?? null,
  };
}

function mapLogResult(log: LogResult): GitLogResponse {
  return {
    entries: log.all.map((entry) => ({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author: entry.author_name,
    })),
    total: log.total,
  };
}

export async function isGitRepo(path: string): Promise<boolean> {
  try {
    const git = createGitInstance(path);
    return await git.checkIsRepo();
  } catch {
    return false;
  }
}

export async function getStatus(workingDir: string): Promise<GitStatusResponse> {
  try {
    const git = createGitInstance(workingDir);
    const status = await git.status();
    return mapStatusResult(status);
  } catch (error) {
    throw new GitServiceError(
      `Failed to get git status: ${error instanceof Error ? error.message : String(error)}`,
      'UNKNOWN'
    );
  }
}

export async function addFiles(workingDir: string, files: string[]): Promise<void> {
  try {
    const git = createGitInstance(workingDir);
    await git.add(files);
  } catch (error) {
    throw new GitServiceError(
      `Failed to stage files: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function commit(workingDir: string, message: string): Promise<GitCommitResponse> {
  try {
    const git = createGitInstance(workingDir);
    const result = await git.commit(message);
    return {
      hash: result.commit,
      message,
    };
  } catch (error) {
    throw new GitServiceError(
      `Failed to commit: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getLog(workingDir: string, maxCount?: number): Promise<GitLogResponse> {
  try {
    const git = createGitInstance(workingDir);
    const options = maxCount !== undefined ? { maxCount } : undefined;
    const log = await git.log(options);
    return mapLogResult(log);
  } catch (error) {
    throw new GitServiceError(
      `Failed to get log: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getDiff(workingDir: string, staged?: boolean): Promise<GitDiffResponse> {
  try {
    const git = createGitInstance(workingDir);
    const args = staged === true ? ['--cached'] : [];
    const diff = await git.diff(args);
    const numStat = await git.diff([...args, '--numstat']);
    const filesChanged = numStat.split('\n').filter((line) => line.trim().length > 0).length;
    return { diff, filesChanged };
  } catch (error) {
    throw new GitServiceError(
      `Failed to get diff: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getBranches(workingDir: string): Promise<GitBranchesResponse> {
  try {
    const git = createGitInstance(workingDir);
    const branchSummary = await git.branch();
    const branches = Object.values(branchSummary.branches).map((b) => ({
      name: b.name,
      current: b.current,
    }));
    return {
      branches,
      current: branchSummary.current,
    };
  } catch (error) {
    throw new GitServiceError(
      `Failed to get branches: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function checkout(workingDir: string, branch: string): Promise<GitCheckoutResponse> {
  try {
    const git = createGitInstance(workingDir);
    await git.checkout(branch);
    return { success: true, branch };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('did not match any')) {
      throw new GitServiceError(`Branch '${branch}' not found`, 'BRANCH_NOT_FOUND');
    }
    if (message.includes('conflict')) {
      throw new GitServiceError(`Merge conflict during checkout`, 'MERGE_CONFLICT');
    }
    throw new GitServiceError(`Failed to checkout: ${message}`);
  }
}
