import { liveSourceText } from '@renderer/components/tabs/live-source-text';
import { useDocumentStore } from '@renderer/stores/document-store';
import {
  clearPendingExternalChange,
  noteFileRemoved,
  noteInactiveExternalChange,
} from '@renderer/components/tabs/external-tab-change';

type FileRead = { readonly ok: true; readonly value: string } | { readonly ok: false };

/**
 * Apply a watcher event. A delete that is followed by a readable file is a
 * replacement, such as an atomic save, and the file stays open.
 */
export async function applyWatchedFileEvent(
  event: { readonly type: 'change' | 'unlink'; readonly path: string },
  readFile: (path: string) => Promise<FileRead>
): Promise<void> {
  const readable = await readFile(event.path);
  if (!readable.ok) {
    if (event.type !== 'unlink') {
      return;
    }
    const openInEditor = useDocumentStore.getState().filePath === event.path;
    if (noteFileRemoved(event.path, openInEditor) && openInEditor) {
      useDocumentStore.getState().markFileMissing();
    }
    return;
  }

  clearPendingExternalChange(event.path);
  const state = useDocumentStore.getState();
  if (state.filePath !== event.path) {
    noteInactiveExternalChange(event.path, readable.value, Date.now());
    return;
  }
  const typed = liveSourceText();
  if (typed !== null && typed !== state.content) {
    state.setContent(typed);
  }
  const current = useDocumentStore.getState();
  if (current.filePath !== event.path) {
    return;
  }
  const shown = liveSourceText() ?? current.content;
  if (shown === readable.value || current.savedContent === readable.value) {
    if (current.fileMissing) {
      useDocumentStore.setState({ fileMissing: false });
    }
    return;
  }
  current.handleExternalChange(readable.value, Date.now());
}
