/**
 * Accept an operating-system file drop and tell the renderer about it.
 * The renderer cannot supply the path.
 */

import { ipcRenderer, webUtils } from 'electron';

import {
  DroppedFileResponseSchema,
  type DroppedFileResponse,
} from '@shared/contracts/file-schemas';
import { IPC_CHANNELS } from '@shared/lib/ipc';

const droppedFileListeners = new Set<(event: DroppedFileResponse) => void>();

function notify(event: DroppedFileResponse): void {
  for (const listener of droppedFileListeners) {
    listener(event);
  }
}

function pathForDroppedFile(file: File): string {
  try {
    return webUtils.getPathForFile(file);
  } catch {
    return '';
  }
}

function acceptDrop(event: DragEvent): void {
  event.preventDefault();
  const file = event.dataTransfer?.files[0];
  if (!file) {
    return;
  }
  const filePath = pathForDroppedFile(file);
  if (filePath.length === 0) {
    return;
  }
  void ipcRenderer
    .invoke(IPC_CHANNELS.file.openDropped, { path: filePath })
    .then((response: unknown) => {
      const parsed = DroppedFileResponseSchema.safeParse(response);
      if (parsed.success) {
        notify(parsed.data);
      }
    })
    .catch(() => undefined);
}

export function installDroppedFileListener(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.addEventListener('dragover', (event) => {
    event.preventDefault();
  });
  window.addEventListener('drop', acceptDrop);
}

export function onDroppedFile(callback: (event: DroppedFileResponse) => void): () => void {
  droppedFileListeners.add(callback);
  return () => {
    droppedFileListeners.delete(callback);
  };
}
