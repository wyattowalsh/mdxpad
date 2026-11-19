import { liveSourceText } from '@renderer/components/tabs/live-source-text';
import { useDocumentStore } from '@renderer/stores/document-store';

/** Editor text for the file the agent was opened on, including unstored keystrokes. */
export function openEditorText(filePath: string | undefined): string | undefined {
  if (filePath === undefined) {
    return undefined;
  }
  const state = useDocumentStore.getState();
  if (state.filePath !== filePath) {
    return undefined;
  }
  return liveSourceText() ?? state.content;
}
