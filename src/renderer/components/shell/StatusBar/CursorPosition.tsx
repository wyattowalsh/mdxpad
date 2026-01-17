/**
 * CursorPosition Component
 *
 * Displays the current cursor position in "Ln X, Col Y" format.
 * Uses 1-indexed line and column numbers.
 *
 * @module renderer/components/shell/StatusBar/CursorPosition
 */

import { memo } from 'react';
import type { CursorPositionProps } from './types';

/**
 * CursorPosition displays the current editor cursor location.
 *
 * @example
 * ```tsx
 * <CursorPosition line={42} column={15} />
 * // Renders: "Ln 42, Col 15"
 * ```
 */
function CursorPositionComponent({ line, column }: CursorPositionProps) {
  return (
    <div
      className="text-sm text-muted-foreground whitespace-nowrap"
      aria-label={`Line ${line}, Column ${column}`}
      data-testid="cursor-position"
    >
      Ln {line}, Col {column}
    </div>
  );
}

export const CursorPosition = memo(CursorPositionComponent);
CursorPosition.displayName = 'CursorPosition';
