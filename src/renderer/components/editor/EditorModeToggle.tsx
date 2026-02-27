/**
 * Editor Mode Toggle Component
 *
 * Toggle between source (CodeMirror) and WYSIWYG (ProseMirror) editing modes.
 * Shows visual indicator of current mode with keyboard shortcut hint.
 *
 * @module renderer/components/editor/EditorModeToggle
 */

import * as React from 'react';
import { Code, Eye } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { useEditorModeStore, selectEditorMode } from '../../stores/editor-mode-store';

// =============================================================================
// TYPES
// =============================================================================

export interface EditorModeToggleProps {
  readonly className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Detect if the user is on macOS using userAgentData (modern) or userAgent (fallback).
 */
function detectMac(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any -- userAgentData is not in all TS DOM libs
  const uaData = (navigator as any).userAgentData as { platform?: string } | undefined;
  if (uaData?.platform) {
    return uaData.platform === 'macOS';
  }
  return navigator.userAgent.includes('Mac');
}

const SourceButton: React.FC<{
  readonly active: boolean;
  readonly onClick: () => void;
  readonly onKeyDown: (e: React.KeyboardEvent) => void;
}> = ({ active, onClick, onKeyDown }) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'
    )}
    onClick={onClick}
    onKeyDown={onKeyDown}
  >
    <Code className="h-3.5 w-3.5" />
    Source
  </button>
);
SourceButton.displayName = 'SourceButton';

const WysiwygButton: React.FC<{
  readonly active: boolean;
  readonly onClick: () => void;
  readonly onKeyDown: (e: React.KeyboardEvent) => void;
}> = ({ active, onClick, onKeyDown }) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'
    )}
    onClick={onClick}
    onKeyDown={onKeyDown}
  >
    <Eye className="h-3.5 w-3.5" />
    WYSIWYG
  </button>
);
WysiwygButton.displayName = 'WysiwygButton';

export const EditorModeToggle: React.FC<EditorModeToggleProps> = ({ className }) => {
  const mode = useEditorModeStore(selectEditorMode);
  const toggleMode = useEditorModeStore((s) => s.toggleMode);
  const setMode = useEditorModeStore((s) => s.setMode);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleMode();
      }
    },
    [toggleMode]
  );

  const isMac = detectMac();
  const shortcutHint = isMac ? '\u2318E' : 'Ctrl+E';

  return (
    <div
      className={cn('inline-flex items-center rounded-md border bg-muted p-0.5', className)}
      role="radiogroup"
      aria-label="Editor mode"
    >
      <SourceButton
        active={mode === 'source'}
        onClick={() => setMode('source')}
        onKeyDown={handleKeyDown}
      />
      <WysiwygButton
        active={mode === 'wysiwyg'}
        onClick={() => setMode('wysiwyg')}
        onKeyDown={handleKeyDown}
      />
      <span className="ml-1 text-[10px] text-muted-foreground" aria-hidden>
        {shortcutHint}
      </span>
    </div>
  );
};

EditorModeToggle.displayName = 'EditorModeToggle';
