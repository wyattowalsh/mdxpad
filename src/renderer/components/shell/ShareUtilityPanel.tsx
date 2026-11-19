import { useEffect, useRef, useState } from 'react';
import type { ShareAccessMode, ShareLink } from '@shared/contracts/share-schemas';
import { useDocumentStore } from '@renderer/stores/document-store';
import { selectActiveTabId, useTabStore } from '@renderer/stores/tab-store';
import { ShareDialog } from '@renderer/components/share/ShareDialog';
import { liveSourceText } from '@renderer/components/tabs/live-source-text';
import { openShareLink } from '@renderer/lib/open-share-link';
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
  const [linkState, setLinkState] = useState<{
    readonly docId: string;
    readonly links: readonly ShareLink[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const docId = shareDocumentId(filePath, activeTabId);
  const links = linkState?.docId === docId ? linkState.links : [];
  const previousDocId = useRef<string | null>(null);

  function currentDocumentId(): string | null {
    return shareDocumentId(
      useDocumentStore.getState().filePath,
      useTabStore.getState().activeTabId
    );
  }

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
        if (!cancelled) setLinkState({ docId, links: result.links });
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
        const createdFor = docId;
        const snapshot = liveSourceText() ?? useDocumentStore.getState().content;
        void window.mdxpad.share
          .createLink({ docId, accessMode, expiresInMs: null, content: snapshot })
          .then((result) => {
            if (currentDocumentId() !== createdFor) return;
            setLinkState((current) => {
              const existing = current?.docId === createdFor ? current.links : [];
              return { docId: createdFor, links: [result.link, ...existing] };
            });
          })
          .catch((caught: unknown) => {
            if (currentDocumentId() !== createdFor) return;
            setError(caught instanceof Error ? caught.message : 'Could not create a share link');
          });
      }}
      onRevokeLink={(linkId) => {
        if (!window.mdxpad.share) return;
        setError(null);
        const revokedFor = docId;
        void window.mdxpad.share
          .revokeLink({ id: linkId })
          .then(() => {
            if (currentDocumentId() !== revokedFor) return;
            setLinkState((current) => {
              if (current?.docId !== revokedFor) return current;
              return {
                docId: revokedFor,
                links: current.links.filter((link) => link.id !== linkId),
              };
            });
          })
          .catch((caught: unknown) => {
            if (currentDocumentId() !== revokedFor) return;
            setError(caught instanceof Error ? caught.message : 'Could not revoke this share link');
          });
      }}
      onCopyLink={(url) => {
        void navigator.clipboard.writeText(url);
      }}
      onOpenLink={(url) => {
        void openShareLink(url).then((opened) => {
          if (!opened) {
            setError('Could not open that share link');
            return;
          }
          useUtilityPanelStore.getState().setActiveUtilityPanel(null);
        });
      }}
    />
  );
}
