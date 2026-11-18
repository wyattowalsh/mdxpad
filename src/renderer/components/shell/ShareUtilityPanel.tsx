import { useEffect, useRef, useState } from 'react';
import type { ShareAccessMode, ShareLink } from '@shared/contracts/share-schemas';
import { useDocumentStore } from '@renderer/stores/document-store';
import { selectActiveTabId, useTabStore } from '@renderer/stores/tab-store';
import { ShareDialog } from '@renderer/components/share/ShareDialog';
import { useUtilityPanelStore } from '@renderer/stores/utility-panel-store';

function shareDocumentId(filePath: string | null, activeTabId: string | null): string | null {
  if (filePath) {
    return filePath;
  }
  if (activeTabId) {
    return `untitled:${activeTabId}`;
  }
  return null;
}

function savingUntitledTab(
  previousDocId: string | null,
  activeTabId: string | null,
  filePath: string | null
): previousDocId is string {
  return (
    previousDocId !== null &&
    activeTabId !== null &&
    filePath !== null &&
    previousDocId === `untitled:${activeTabId}`
  );
}

export function ShareUtilityPanel(): React.JSX.Element {
  const filePath = useDocumentStore((state) => state.filePath);
  const activeTabId = useTabStore(selectActiveTabId);
  const content = useDocumentStore((state) => state.content);
  const [links, setLinks] = useState<readonly ShareLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const docId = shareDocumentId(filePath, activeTabId);
  const previousDocId = useRef<string | null>(null);

  useEffect(() => {
    if (!docId || !window.mdxpad.share) return;
    const previous = previousDocId.current;
    previousDocId.current = docId;
    const share = window.mdxpad.share;
    const moving = savingUntitledTab(previous, activeTabId, filePath);
    const request = moving
      ? share.moveUntitled({ fromDocId: previous, toDocId: docId })
      : share.getLinks({ docId });
    const fallback = moving
      ? 'Could not keep share links with the saved file'
      : 'Could not load share links';
    let cancelled = false;
    setError(null);
    void request
      .then((result) => {
        if (!cancelled) setLinks(result.links);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : fallback);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTabId, docId, filePath]);

  return (
    <ShareDialog
      isOpen
      onClose={() => useUtilityPanelStore.getState().setActiveUtilityPanel(null)}
      activeLinks={links}
      error={error}
      onCreateLink={(accessMode: ShareAccessMode) => {
        if (!window.mdxpad.share || !docId) return;
        setError(null);
        void window.mdxpad.share
          .createLink({ docId, accessMode, expiresInMs: null, content })
          .then((result) => {
            setLinks((current) => [result.link, ...current]);
          })
          .catch((caught: unknown) => {
            setError(caught instanceof Error ? caught.message : 'Could not create a share link');
          });
      }}
      onRevokeLink={(linkId) => {
        if (!window.mdxpad.share) return;
        setError(null);
        void window.mdxpad.share
          .revokeLink({ id: linkId })
          .then(() => {
            setLinks((current) => current.filter((link) => link.id !== linkId));
          })
          .catch((caught: unknown) => {
            setError(caught instanceof Error ? caught.message : 'Could not revoke this share link');
          });
      }}
      onCopyLink={(url) => {
        void navigator.clipboard.writeText(url);
      }}
    />
  );
}
