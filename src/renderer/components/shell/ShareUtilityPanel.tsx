import { useEffect, useState } from 'react';
import type { ShareAccessMode, ShareLink } from '@shared/contracts/share-schemas';
import { useDocumentStore } from '@renderer/stores/document-store';
import { ShareDialog } from '@renderer/components/share/ShareDialog';
import { useUtilityPanelStore } from '@renderer/stores/utility-panel-store';

export function ShareUtilityPanel(): React.JSX.Element {
  const filePath = useDocumentStore((state) => state.filePath);
  const content = useDocumentStore((state) => state.content);
  const [links, setLinks] = useState<readonly ShareLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const docId = filePath ?? 'untitled';

  useEffect(() => {
    if (!window.mdxpad.share) return;
    let cancelled = false;
    setError(null);
    void window.mdxpad.share
      .getLinks({ docId })
      .then((result) => {
        if (!cancelled) setLinks(result.links);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Could not load share links');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  return (
    <ShareDialog
      isOpen
      onClose={() => useUtilityPanelStore.getState().setActiveUtilityPanel(null)}
      activeLinks={links}
      error={error}
      onCreateLink={(accessMode: ShareAccessMode) => {
        if (!window.mdxpad.share) return;
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
