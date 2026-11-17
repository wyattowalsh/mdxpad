import { useEffect, useState } from 'react';
import type { ShareAccessMode, ShareLink } from '@shared/contracts/share-schemas';
import { useDocumentStore } from '@renderer/stores/document-store';
import { ShareDialog } from '@renderer/components/share/ShareDialog';
import { useUtilityPanelStore } from '@renderer/stores/utility-panel-store';

export function ShareUtilityPanel(): React.JSX.Element {
  const filePath = useDocumentStore((state) => state.filePath);
  const content = useDocumentStore((state) => state.content);
  const [links, setLinks] = useState<readonly ShareLink[]>([]);
  const docId = filePath ?? 'untitled';

  useEffect(() => {
    if (!window.mdxpad.share) return;
    void window.mdxpad.share.getLinks({ docId }).then((result) => {
      setLinks(result.links);
    });
  }, [docId]);

  return (
    <ShareDialog
      isOpen
      onClose={() => useUtilityPanelStore.getState().setActiveUtilityPanel(null)}
      activeLinks={links}
      onCreateLink={(accessMode: ShareAccessMode) => {
        if (!window.mdxpad.share) return;
        void window.mdxpad.share
          .createLink({ docId, accessMode, expiresInMs: null, content })
          .then((result) => {
            setLinks((current) => [result.link, ...current]);
          });
      }}
      onRevokeLink={(linkId) => {
        if (!window.mdxpad.share) return;
        void window.mdxpad.share.revokeLink({ id: linkId }).then(() => {
          setLinks((current) => current.filter((link) => link.id !== linkId));
        });
      }}
      onCopyLink={(url) => {
        void navigator.clipboard.writeText(url);
      }}
    />
  );
}
