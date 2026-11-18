/**
 * Tags for the open file, plus the taxonomy tree.
 */

import { useMemo } from 'react';
import { useDocumentStore } from '@renderer/stores/document-store';
import { selectActiveTabId, useTabStore } from '@renderer/stores/tab-store';
import { selectSelectedTags, useTagStore } from '@renderer/stores/tag-store';
import { openFileFromPath } from '@renderer/lib/open-file-from-path';
import { activateDocumentTab } from '@renderer/components/tabs/document-tabs';
import { TagPicker } from './TagPicker';
import { TagTreePanel } from './TagTreePanel';
import { tagDocumentKey } from './tag-document';

function filesForSelectedTags(
  selectedTags: readonly string[],
  fileTagMap: Readonly<Record<string, readonly string[]>>
): readonly string[] {
  if (selectedTags.length === 0) {
    return [];
  }
  const wanted = new Set(selectedTags);
  return Object.entries(fileTagMap)
    .filter(([, tagIds]) => tagIds.some((tagId) => wanted.has(tagId)))
    .map(([path]) => path)
    .sort();
}

function fileLabel(filePath: string): string {
  if (filePath.startsWith('untitled:')) {
    return 'Untitled';
  }
  const parts = filePath.split('/').filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? filePath;
}

function openTaggedDocument(filePath: string): void {
  if (filePath.startsWith('untitled:')) {
    activateDocumentTab(filePath.slice('untitled:'.length));
    return;
  }
  void openFileFromPath(filePath);
}

export function TagsUtilityPanel(): React.JSX.Element {
  const filePath = useDocumentStore((state) => state.filePath);
  const activeTabId = useTabStore(selectActiveTabId);
  const documentKey = tagDocumentKey(filePath, activeTabId);
  const selectedTags = useTagStore(selectSelectedTags);
  const fileTagMap = useTagStore((state) => state.fileTagMap);
  const matchingFiles = useMemo(
    () => filesForSelectedTags(selectedTags, fileTagMap),
    [selectedTags, fileTagMap]
  );

  return (
    <div className="space-y-4" data-testid="tags-utility-panel">
      {documentKey ? (
        <TagPicker filePath={documentKey} />
      ) : (
        <p className="text-sm text-muted-foreground">Open a file to assign tags.</p>
      )}
      <TagTreePanel onTagClick={(tagId) => useTagStore.getState().toggleSelectedTag(tagId)} />
      {selectedTags.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-medium">Files with selected tags</h3>
          {matchingFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files use the selected tags.</p>
          ) : (
            <ul className="space-y-1">
              {matchingFiles.map((path) => (
                <li key={path}>
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() => {
                      openTaggedDocument(path);
                    }}
                  >
                    {fileLabel(path)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
