import { useEffect, useMemo, useState } from 'react';
import { diffLines } from 'diff';
import { useDocumentStore } from '@renderer/stores/document-store';
import { selectEntries, useVersionHistoryStore } from '@renderer/stores/version-history-store';
import { VersionDiff } from '@renderer/components/history/VersionDiff';
import { VersionRestoreDialog } from '@renderer/components/history/VersionRestoreDialog';
import { VersionTimeline } from '@renderer/components/history/VersionTimeline';

export function HistoryUtilityPanel(): React.JSX.Element {
  const filePath = useDocumentStore((state) => state.filePath);
  const content = useDocumentStore((state) => state.content);
  const entries = useVersionHistoryStore(selectEntries);
  const selectedEntryId = useVersionHistoryStore((state) => state.selectedEntryId);
  const loadHistory = useVersionHistoryStore((state) => state.loadHistory);
  const selectEntry = useVersionHistoryStore((state) => state.selectEntry);
  const [versionContent, setVersionContent] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (!filePath || !window.mdxpad.history) {
      return;
    }
    void window.mdxpad.history.getHistory(filePath).then((result) => {
      loadHistory(result.entries, filePath);
    });
  }, [filePath, loadHistory]);

  useEffect(() => {
    if (!filePath || !selectedEntryId || !window.mdxpad.history) {
      setVersionContent(null);
      return;
    }
    void window.mdxpad.history.getVersion(selectedEntryId, filePath).then((result) => {
      setVersionContent(result.content);
    });
  }, [filePath, selectedEntryId]);

  const selected = entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const counts = useMemo(() => {
    if (versionContent === null) {
      return { added: 0, removed: 0 };
    }
    let added = 0;
    let removed = 0;
    for (const change of diffLines(versionContent, content)) {
      const lines = change.count;
      if (change.added) added += lines;
      if (change.removed) removed += lines;
    }
    return { added, removed };
  }, [content, versionContent]);

  return (
    <div className="space-y-3" data-testid="history-utility-panel">
      {filePath === null ? (
        <p className="text-sm text-muted-foreground">Open a file to see its history.</p>
      ) : (
        <VersionTimeline
          entries={entries}
          selectedEntryId={selectedEntryId}
          onSelect={selectEntry}
        />
      )}
      {versionContent !== null && (
        <VersionDiff oldContent={versionContent} newContent={content} oldLabel="Saved version" />
      )}
      {selected && (
        <button type="button" className="text-sm underline" onClick={() => setRestoreOpen(true)}>
          Restore this version
        </button>
      )}
      {selected && (
        <VersionRestoreDialog
          entry={selected}
          addedLines={counts.added}
          removedLines={counts.removed}
          isOpen={restoreOpen}
          isRestoring={isRestoring}
          onCancel={() => setRestoreOpen(false)}
          onRestore={(createBackup) => {
            if (!filePath || !window.mdxpad.history) return;
            setIsRestoring(true);
            void window.mdxpad.history.restore(selected.id, filePath, createBackup).finally(() => {
              setIsRestoring(false);
              setRestoreOpen(false);
            });
          }}
        />
      )}
    </div>
  );
}
