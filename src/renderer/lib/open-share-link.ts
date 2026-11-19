/**
 * Open the document snapshot stored for a share link.
 * The document id on the link is not a filesystem path.
 */

import { shareTokenFromUrl } from '@shared/lib/share-url';
import { externalChangeFields } from '@renderer/components/tabs/external-tab-change';
import { noteTabEpoch, whileApplyingTabs } from '@renderer/components/tabs/document-tabs';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

const SHARED_DOCUMENT_NAME = 'Shared.mdx';

function rememberCurrentTab(): void {
  const tabs = useTabStore.getState();
  const current = tabs.tabs.find((tab) => tab.id === tabs.activeTabId);
  if (!current) {
    return;
  }
  const document = useDocumentStore.getState();
  tabs.updateTab(current.id, {
    filePath: document.filePath,
    fileName: document.fileName,
    isDirty: document.isDirty,
    content: document.content,
    savedContent: document.savedContent,
    fileMissing: document.fileMissing,
  });
}

/** Show a shared snapshot in a new untitled tab. */
export function openSharedSnapshot(content: string): void {
  rememberCurrentTab();
  const id = useTabStore.getState().addTab({
    filePath: null,
    fileName: SHARED_DOCUMENT_NAME,
    isDirty: content.length > 0,
    content,
    savedContent: '',
  });
  noteTabEpoch(id);
  const external = externalChangeFields(null);
  whileApplyingTabs(() => {
    useDocumentStore.setState({
      fileId: null,
      filePath: null,
      fileName: SHARED_DOCUMENT_NAME,
      content,
      savedContent: '',
      isDirty: content.length > 0,
      lastKnownMtime: null,
      fileMissing: false,
      ...external,
    });
  });
}

/** Read a share URL and open its snapshot. */
export async function openShareLink(url: string): Promise<boolean> {
  const token = shareTokenFromUrl(url);
  const share = window.mdxpad.share;
  if (token === null || share === undefined) {
    return false;
  }
  const result = await share.read({ token });
  if (!result.ok || result.content === undefined) {
    return false;
  }
  openSharedSnapshot(result.content);
  return true;
}
