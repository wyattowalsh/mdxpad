/**
 * Opens a Markdown or MDX file dropped onto the window.
 * The path is supplied by the preload from the operating-system drop.
 */

import { useEffect } from 'react';

import { useStatusMessageStore } from '@renderer/stores/status-message-store';

import { openFileFromPath } from '@renderer/lib/open-file-from-path';

export function useDragDrop(onFileDrop: (filePath: string) => void = openFileFromPath): void {
  useEffect(() => {
    return window.mdxpad.onDroppedFile((event) => {
      if (!event.ok) {
        useStatusMessageStore.getState().show(event.message);
        return;
      }
      onFileDrop(event.path);
    });
  }, [onFileDrop]);
}
