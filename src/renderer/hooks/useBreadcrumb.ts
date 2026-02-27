/**
 * useBreadcrumb Hook
 *
 * Derives breadcrumb navigation segments from the current workspace path,
 * file path, and active heading from the outline store.
 *
 * @module renderer/hooks/useBreadcrumb
 */

import { useMemo } from 'react';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useOutlineStore } from '@renderer/stores/outline-store';
import { useWorkspaceStore } from '@renderer/stores/workspace-store';

export interface BreadcrumbSegment {
  readonly id: string;
  readonly label: string;
  readonly type: 'workspace' | 'folder' | 'file' | 'heading';
  readonly path?: string | undefined;
}

/**
 * Extract folder segments from a file path relative to a workspace root.
 */
function getFolderSegments(filePath: string, workspaceRoot: string | null): BreadcrumbSegment[] {
  if (!workspaceRoot) return [];

  const normalizedFile = filePath.replace(/\\/g, '/');
  const normalizedRoot = workspaceRoot.replace(/\\/g, '/');

  if (!normalizedFile.startsWith(normalizedRoot)) return [];

  const relative = normalizedFile.slice(normalizedRoot.length).replace(/^\//, '');
  const parts = relative.split('/');

  // Remove filename (last part)
  parts.pop();

  return parts.map((part, index) => ({
    id: `folder-${index}-${part}`,
    label: part,
    type: 'folder' as const,
    path: normalizedRoot + '/' + parts.slice(0, index + 1).join('/'),
  }));
}

/**
 * Get the first heading from the outline store to use as the current section.
 */
function getActiveHeading(
  sections: ReturnType<typeof useOutlineStore.getState>['sections']
): BreadcrumbSegment | null {
  const headingsSection = sections.find((s) => s.id === 'headings');
  if (!headingsSection || headingsSection.items.length === 0) return null;

  const firstHeading = headingsSection.items[0];
  if (!firstHeading) return null;

  return {
    id: `heading-${firstHeading.id}`,
    label: firstHeading.label,
    type: 'heading' as const,
  };
}

/**
 * Hook that derives breadcrumb segments from workspace, file, and outline state.
 *
 * @returns Array of breadcrumb segments
 */
export function useBreadcrumb(): BreadcrumbSegment[] {
  const fileName = useDocumentStore((state) => state.fileName);
  const filePath = useDocumentStore((state) => state.filePath);
  const workspaceModel = useWorkspaceStore((state) => state.model);
  const sections = useOutlineStore((state) => state.sections);

  return useMemo(() => {
    const segments: BreadcrumbSegment[] = [];

    const workspaceRoot = workspaceModel?.workspace.rootPath ?? null;
    const workspaceName = workspaceModel?.workspace.name ?? null;

    // Workspace segment
    if (workspaceName) {
      segments.push({
        id: 'workspace',
        label: workspaceName,
        type: 'workspace',
        path: workspaceRoot ?? undefined,
      });
    }

    // Folder segments
    if (filePath && workspaceRoot) {
      segments.push(...getFolderSegments(filePath, workspaceRoot));
    }

    // File segment
    segments.push({
      id: 'file',
      label: fileName,
      type: 'file',
      path: filePath ?? undefined,
    });

    // Heading segment
    const heading = getActiveHeading(sections);
    if (heading) {
      segments.push(heading);
    }

    return segments;
  }, [fileName, filePath, workspaceModel, sections]);
}
