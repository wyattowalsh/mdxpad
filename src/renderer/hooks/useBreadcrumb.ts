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
import type { OutlineItem } from '@shared/types/outline';

export interface BreadcrumbSegment {
  readonly id: string;
  readonly label: string;
  readonly type: 'workspace' | 'folder' | 'file' | 'heading';
  readonly path?: string | undefined;
  readonly line?: number | undefined;
  readonly column?: number | undefined;
  readonly level?: OutlineItem['level'] | undefined;
  readonly outlineId?: string | undefined;
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

function flattenHeadings(items: readonly OutlineItem[]): OutlineItem[] {
  return items.flatMap((item) => [item, ...flattenHeadings(item.children)]);
}

function getActiveHeading(
  sections: ReturnType<typeof useOutlineStore.getState>['sections'],
  cursorLine: number
): BreadcrumbSegment | null {
  const headingsSection = sections.find((s) => s.id === 'headings');
  if (!headingsSection || headingsSection.items.length === 0) return null;

  const headings = flattenHeadings(headingsSection.items);
  let current: OutlineItem | null = null;
  for (const heading of headings) {
    if (heading.line <= cursorLine) {
      current = heading;
    }
  }
  if (!current) return null;

  return {
    id: `heading-${current.id}`,
    label: current.label,
    type: 'heading' as const,
    line: current.line,
    column: current.column,
    level: current.level,
    outlineId: current.id,
  };
}

/**
 * Hook that derives breadcrumb segments from workspace, file, and outline state.
 *
 * @returns Array of breadcrumb segments
 */
export function useBreadcrumb(cursorLine = 1): BreadcrumbSegment[] {
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
    const heading = getActiveHeading(sections, cursorLine);
    if (heading) {
      segments.push(heading);
    }

    return segments;
  }, [cursorLine, fileName, filePath, workspaceModel, sections]);
}
