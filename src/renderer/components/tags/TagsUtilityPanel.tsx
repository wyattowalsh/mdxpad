/**
 * Tags for the open file, plus the taxonomy tree.
 */

import { useMemo } from 'react';
import { useDocumentStore } from '@renderer/stores/document-store';
import { selectSelectedTags, useTagStore } from '@renderer/stores/tag-store';
import { openFileFromPath } from '@renderer/lib/open-file-from-path';
import { TagPicker } from './TagPicker';
import { TagTreePanel } from './TagTreePanel';

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
  const parts = filePath.split('/').filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? filePath;
}

export function TagsUtilityPanel(): React.JSX.Element {
  const filePath = useDocumentStore((state) => state.filePath);
  const selectedTags = useTagStore(selectSelectedTags);
  const fileTagMap = useTagStore((state) => state.fileTagMap);
  const matchingFiles = useMemo(
    () => filesForSelectedTags(selectedTags, fileTagMap),
    [selectedTags, fileTagMap]
  );

  return (
    <div className="space-y-4" data-testid="tags-utility-panel">
      {filePath ? (
        <TagPicker filePath={filePath} />
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
                      void openFileFromPath(path);
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
