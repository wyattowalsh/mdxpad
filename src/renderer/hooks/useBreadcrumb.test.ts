/**
 * useBreadcrumb Hook Tests
 *
 * Tests for deriving breadcrumb segments from workspace, file, and outline state.
 *
 * @module renderer/hooks/useBreadcrumb.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useOutlineStore } from '@renderer/stores/outline-store';
import { useWorkspaceStore } from '@renderer/stores/workspace-store';
import { useBreadcrumb } from './useBreadcrumb';

describe('useBreadcrumb', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useOutlineStore.getState().reset();
    useWorkspaceStore.getState().reset();
  });

  it('should return file segment for untitled document', () => {
    const { result } = renderHook(() => useBreadcrumb());

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toEqual(expect.objectContaining({ type: 'file', label: 'Untitled' }));
  });

  it('should include file segment with correct name', () => {
    useDocumentStore.setState({ fileName: 'test.mdx', filePath: '/test/test.mdx' });

    const { result } = renderHook(() => useBreadcrumb());

    const fileSegment = result.current.find((s) => s.type === 'file');
    expect(fileSegment?.label).toBe('test.mdx');
  });

  it('should not include workspace segment when no workspace is loaded', () => {
    const { result } = renderHook(() => useBreadcrumb());

    const workspaceSegment = result.current.find((s) => s.type === 'workspace');
    expect(workspaceSegment).toBeUndefined();
  });

  it('should include folder segments when file is inside workspace', () => {
    useWorkspaceStore.setState({
      model: {
        version: 1,
        workspace: {
          id: 'ws-1',
          name: 'My Workspace',
          rootPath: '/workspace',
          documents: [],
          createdAt: '',
          updatedAt: '',
          activeDocumentId: null,
        },
        projects: [],
        linkIndex: {},
      },
    });
    useDocumentStore.setState({
      fileName: 'readme.mdx',
      filePath: '/workspace/docs/guides/readme.mdx',
    });

    const { result } = renderHook(() => useBreadcrumb());

    const types = result.current.map((s) => s.type);
    expect(types).toContain('workspace');
    expect(types).toContain('folder');
    expect(types).toContain('file');

    const folderSegments = result.current.filter((s) => s.type === 'folder');
    expect(folderSegments).toHaveLength(2);
    expect(folderSegments[0]?.label).toBe('docs');
    expect(folderSegments[1]?.label).toBe('guides');
  });

  it('shows the heading at the cursor', () => {
    useOutlineStore.setState({
      sections: [
        {
          id: 'headings',
          label: 'Headings',
          isCollapsed: false,
          isEmpty: false,
          items: [
            {
              id: 'intro',
              type: 'heading',
              label: 'Intro',
              level: 1,
              line: 1,
              column: 1,
              children: [],
            },
            {
              id: 'details',
              type: 'heading',
              label: 'Details',
              level: 2,
              line: 8,
              column: 1,
              children: [],
            },
          ],
        },
      ],
    });

    const atIntro = renderHook(() => useBreadcrumb(3));
    expect(atIntro.result.current.find((segment) => segment.type === 'heading')?.label).toBe(
      'Intro'
    );

    const atDetails = renderHook(() => useBreadcrumb(10));
    const heading = atDetails.result.current.find((segment) => segment.type === 'heading');
    expect(heading?.label).toBe('Details');
    expect(heading?.line).toBe(8);
  });
});
