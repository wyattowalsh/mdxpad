import { liveSourceText } from '@renderer/components/tabs/live-source-text';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

const MAX_OPEN_FILES = 30;
const MAX_OPEN_FILE_CHARS = 8_000_000;

export interface OpenEditorBuffer {
  readonly path: string;
  readonly content: string;
}

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

function remember(files: OpenEditorBuffer[], path: string, content: string): void {
  if (files.length >= MAX_OPEN_FILES || content.length > MAX_OPEN_FILE_CHARS) {
    return;
  }
  if (files.some((file) => file.path === path)) {
    return;
  }
  files.push({ path, content });
}

/** Text for every open file, with the active editor ahead of its stored tab. */
export function openEditorFiles(): OpenEditorBuffer[] {
  const state = useDocumentStore.getState();
  const live = state.filePath === null ? null : (liveSourceText() ?? state.content);
  const files: OpenEditorBuffer[] = [];
  for (const tab of useTabStore.getState().tabs) {
    if (tab.filePath === null) {
      continue;
    }
    const content = tab.filePath === state.filePath && live !== null ? live : tab.content;
    remember(files, tab.filePath, content);
  }
  if (state.filePath !== null && live !== null) {
    remember(files, state.filePath, live);
  }
  return files;
}
