import { useEffect, useMemo, useState } from 'react';
import { useDocumentStore } from '@renderer/stores/document-store';
import { selectEntries, useVersionHistoryStore } from '@renderer/stores/version-history-store';
import { VersionDiff } from '@renderer/components/history/VersionDiff';
import { VersionRestoreDialog } from '@renderer/components/history/VersionRestoreDialog';
import { VersionTimeline } from '@renderer/components/history/VersionTimeline';
import { applyRestoredVersion } from './apply-restored-version';
import { restoreChangeCounts } from './restore-change-counts';

export function HistoryUtilityPanel(): React.JSX.Element {
  const filePath = useDocumentStore((state) => state.filePath);
  const content = useDocumentStore((state) => state.content);
  const entries = useVersionHistoryStore(selectEntries);
  const selectedEntryId = useVersionHistoryStore((state) => state.selectedEntryId);
  const loadHistory = useVersionHistoryStore((state) => state.loadHistory);
  const selectEntry = useVersionHistoryStore((state) => state.selectEntry);
  const error = useVersionHistoryStore((state) => state.error);
  const setError = useVersionHistoryStore((state) => state.setError);
  const setLoading = useVersionHistoryStore((state) => state.setLoading);
  const [versionContent, setVersionContent] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath || !window.mdxpad.history) {
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void window.mdxpad.history
      .getHistory(filePath)
      .then((result) => {
        if (!cancelled) loadHistory(result.entries, filePath);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLoading(false);
        setError(caught instanceof Error ? caught.message : 'Could not load version history');
      });
    return () => {
      cancelled = true;
    };
  }, [filePath, loadHistory, setError, setLoading]);

  useEffect(() => {
    if (!filePath || !selectedEntryId || !window.mdxpad.history) {
      setVersionContent(null);
      return;
    }
    let cancelled = false;
    void window.mdxpad.history
      .getVersion(selectedEntryId, filePath)
      .then((result) => {
        if (!cancelled) setVersionContent(result.content);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setVersionContent(null);
        setError(caught instanceof Error ? caught.message : 'Could not load this version');
      });
    return () => {
      cancelled = true;
    };
  }, [filePath, selectedEntryId, setError]);

  const selected = entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const counts = useMemo(() => {
    if (versionContent === null) {
      return { restored: 0, removed: 0 };
    }
    return restoreChangeCounts(content, versionContent);
  }, [content, versionContent]);

  return (
    <div className="space-y-3" data-testid="history-utility-panel">
      {filePath === null ? (
        <p className="text-sm text-muted-foreground">Open a file to see its history.</p>
      ) : (
        <>
          {error ? (
            <p className="text-destructive px-3 py-2 text-xs" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="text-sm underline"
            onClick={() => {
              if (!window.mdxpad.history) {
                return;
              }
              const historyApi = window.mdxpad.history;
              setError(null);
              void historyApi
                .createSnapshot(filePath, 'Editor snapshot', content)
                .then(async (result) => {
                  if (!result.ok) {
                    setError(result.error ?? 'Could not save a snapshot');
                    return;
                  }
                  const history = await historyApi.getHistory(filePath);
                  loadHistory(history.entries, filePath);
                })
                .catch((caught: unknown) => {
                  setError(caught instanceof Error ? caught.message : 'Could not save a snapshot');
                });
            }}
          >
            Save a snapshot of the editor
          </button>
          <VersionTimeline
            entries={entries}
            selectedEntryId={selectedEntryId}
            onSelect={selectEntry}
          />
        </>
      )}
      {versionContent !== null && (
        <VersionDiff oldContent={versionContent} newContent={content} oldLabel="Saved version" />
      )}
      {restoreError && <p className="text-sm text-destructive">{restoreError}</p>}
      {selected && (
        <button
          type="button"
          className="text-sm underline"
          onClick={() => {
            setRestoreError(null);
            setRestoreOpen(true);
          }}
        >
          Restore this version
        </button>
      )}
      {selected && (
        <VersionRestoreDialog
          entry={selected}
          addedLines={counts.restored}
          removedLines={counts.removed}
          isOpen={restoreOpen}
          isRestoring={isRestoring}
          onCancel={() => setRestoreOpen(false)}
          onRestore={(createBackup) => {
            if (!filePath || !window.mdxpad.history) return;
            const historyApi = window.mdxpad.history;
            setIsRestoring(true);
            setRestoreError(null);
            void historyApi
              .restore(selected.id, filePath, createBackup, content)
              .then(async (result) => {
                if (!result.ok || result.content === undefined) {
                  setRestoreError(result.error ?? 'Could not restore this version');
                  return;
                }
                if (!applyRestoredVersion(filePath, result.content)) {
                  setRestoreError('The open document changed before the version was restored');
                  return;
                }
                const history = await historyApi.getHistory(filePath);
                loadHistory(history.entries, filePath);
                setRestoreOpen(false);
              })
              .catch((caught: unknown) => {
                setRestoreError(
                  caught instanceof Error ? caught.message : 'Could not restore this version'
                );
              })
              .finally(() => {
                setIsRestoring(false);
              });
          }}
        />
      )}
    </div>
  );
}
