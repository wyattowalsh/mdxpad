/**
 * Drag & Drop Hook
 *
 * Provides file drag-and-drop support for opening files by dropping
 * them onto the application window.
 *
 * @module renderer/hooks/useDragDrop
 */

import { useEffect } from 'react';

/**
 * Accepted file extensions for drag-and-drop opening.
 */
const ACCEPTED_EXTENSIONS = new Set(['.mdx', '.md', '.markdown']);

/**
 * Hook that registers drag-and-drop event listeners on the window
 * to open dropped MDX/Markdown files.
 *
 * @param onFileDrop - Callback invoked with the file path when a valid file is dropped
 */
export function useDragDrop(onFileDrop: (filePath: string) => void): void {
  useEffect(() => {
    const handleDragOver = (e: DragEvent): void => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent): void => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file) return;

      // Check extension
      const name = file.name.toLowerCase();
      const dotIndex = name.lastIndexOf('.');
      if (dotIndex === -1) return;

      const ext = name.slice(dotIndex);
      if (!ACCEPTED_EXTENSIONS.has(ext)) return;

      // Electron provides the path property on dropped files
      const filePath = (file as File & { path?: string }).path;
      if (filePath) {
        onFileDrop(filePath);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onFileDrop]);
}
