/**
 * Tags for the open file, plus the taxonomy tree.
 */

import { useDocumentStore } from '@renderer/stores/document-store';
import { useTagStore } from '@renderer/stores/tag-store';
import { TagPicker } from './TagPicker';
import { TagTreePanel } from './TagTreePanel';

export function TagsUtilityPanel(): React.JSX.Element {
  const filePath = useDocumentStore((state) => state.filePath);

  return (
    <div className="space-y-4" data-testid="tags-utility-panel">
      {filePath ? (
        <TagPicker filePath={filePath} />
      ) : (
        <p className="text-sm text-muted-foreground">Open a file to assign tags.</p>
      )}
      <TagTreePanel onTagClick={(tagId) => useTagStore.getState().toggleSelectedTag(tagId)} />
    </div>
  );
}
