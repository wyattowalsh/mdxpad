/**
 * Tests for filter-utils.ts
 *
 * Tests file tree node visibility computation and auto-expand logic.
 */

import { describe, it, expect } from 'vitest';
import { computeNodeVisibility, shouldAutoExpand } from '../filter-utils';
import type { FileTreeNode, MatchResult, MatchResultMap } from '../../fuzzy-match/types';

function createNode(overrides: Partial<FileTreeNode> = {}): FileTreeNode {
  return {
    id: '/project/src/file.ts',
    name: 'file.ts',
    type: 'file',
    path: '/project/src/file.ts',
    parentId: '/project/src',
    childIds: [],
    depth: 2,
    ...overrides,
  };
}

function createMatchResult(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    nodeId: '/project/src/file.ts',
    score: 10,
    positions: new Set([0, 1]),
    isDirectMatch: true,
    ...overrides,
  };
}

describe('computeNodeVisibility', () => {
  it('should return visible when filter is not active', () => {
    const node = createNode();
    const matchResults: MatchResultMap = new Map();

    expect(computeNodeVisibility(node, matchResults, false)).toBe('visible');
  });

  it('should return visible for direct match', () => {
    const node = createNode({ id: '/test' });
    const matchResults: MatchResultMap = new Map([
      ['/test', createMatchResult({ nodeId: '/test', isDirectMatch: true })],
    ]);

    expect(computeNodeVisibility(node, matchResults, true)).toBe('visible');
  });

  it('should return ancestor-only for indirect match (ancestor)', () => {
    const node = createNode({ id: '/project/src', type: 'folder' });
    const matchResults: MatchResultMap = new Map([
      ['/project/src', createMatchResult({ nodeId: '/project/src', isDirectMatch: false })],
    ]);

    expect(computeNodeVisibility(node, matchResults, true)).toBe('ancestor-only');
  });

  it('should return hidden for nodes not in match results', () => {
    const node = createNode({ id: '/unmatched' });
    const matchResults: MatchResultMap = new Map();

    expect(computeNodeVisibility(node, matchResults, true)).toBe('hidden');
  });
});

describe('shouldAutoExpand', () => {
  it('should not auto-expand file nodes', () => {
    const node = createNode({ type: 'file' });
    const matchResults: MatchResultMap = new Map([
      [node.id, createMatchResult({ nodeId: node.id, isDirectMatch: false })],
    ]);

    expect(shouldAutoExpand(node, matchResults)).toBe(false);
  });

  it('should auto-expand folder that is ancestor of a match', () => {
    const node = createNode({
      id: '/project/src',
      name: 'src',
      type: 'folder',
      childIds: ['/project/src/file.ts'],
    });
    const matchResults: MatchResultMap = new Map([
      ['/project/src', createMatchResult({ nodeId: '/project/src', isDirectMatch: false })],
    ]);

    expect(shouldAutoExpand(node, matchResults)).toBe(true);
  });

  it('should not auto-expand folder with direct match', () => {
    const node = createNode({
      id: '/project/src',
      name: 'src',
      type: 'folder',
      childIds: [],
    });
    const matchResults: MatchResultMap = new Map([
      ['/project/src', createMatchResult({ nodeId: '/project/src', isDirectMatch: true })],
    ]);

    expect(shouldAutoExpand(node, matchResults)).toBe(false);
  });

  it('should not auto-expand folder not in match results', () => {
    const node = createNode({
      id: '/project/other',
      name: 'other',
      type: 'folder',
      childIds: [],
    });
    const matchResults: MatchResultMap = new Map();

    expect(shouldAutoExpand(node, matchResults)).toBe(false);
  });
});
