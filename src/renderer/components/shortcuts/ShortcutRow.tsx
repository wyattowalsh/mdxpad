/**
 * Shortcut Row Component
 *
 * Displays a single keyboard shortcut with its command name and current binding.
 * Supports edit mode with key capture for rebinding.
 *
 * @module renderer/components/shortcuts/ShortcutRow
 */

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import type { Keybinding, Modifier } from '../../stores/keybinding-store';

// =============================================================================
// TYPES
// =============================================================================

export interface ShortcutRowProps {
  readonly binding: Keybinding;
  readonly isModified: boolean;
  readonly hasConflict: boolean;
  readonly onRebind: (commandId: string, key: string, modifiers: readonly Modifier[]) => void;
  readonly onReset: (commandId: string) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Detect macOS using userAgentData or userAgent fallback.
 */
function detectMac(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any -- userAgentData is not in all TS DOM libs
  const uaData = (navigator as any).userAgentData as { platform?: string } | undefined;
  if (uaData?.platform) return uaData.platform === 'macOS';
  return navigator.userAgent.includes('Mac');
}

const IS_MAC = detectMac();

const MODIFIER_DISPLAY: Record<string, string> = {
  Mod: IS_MAC ? '\u2318' : 'Ctrl',
  Ctrl: IS_MAC ? '\u2303' : 'Ctrl',
  Shift: IS_MAC ? '\u21E7' : 'Shift',
  Alt: IS_MAC ? '\u2325' : 'Alt',
  Meta: IS_MAC ? '\u2318' : 'Win',
};

function formatBinding(binding: Keybinding): string {
  const parts = binding.modifiers.map((m) => MODIFIER_DISPLAY[m] ?? m);
  parts.push(binding.key.length === 1 ? binding.key.toUpperCase() : binding.key);
  return IS_MAC ? parts.join('') : parts.join('+');
}

function extractModifiers(e: KeyboardEvent): Modifier[] {
  const mods: Modifier[] = [];
  if (IS_MAC && e.metaKey) mods.push('Mod');
  if (!IS_MAC && e.ctrlKey) mods.push('Mod');
  if (e.shiftKey) mods.push('Shift');
  if (e.altKey) mods.push('Alt');
  return mods;
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

// =============================================================================
// COMPONENT
// =============================================================================

const KeyCaptureButton: React.FC<{
  readonly capturedKeys: string;
  readonly inputRef: React.RefObject<HTMLButtonElement | null>;
  readonly onKeyDown: (e: React.KeyboardEvent) => void;
  readonly onBlur: () => void;
}> = ({ capturedKeys, inputRef, onKeyDown, onBlur }) => (
  <button
    ref={inputRef}
    type="button"
    className="rounded-md border border-input bg-background px-3 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
    onKeyDown={onKeyDown}
    onBlur={onBlur}
  >
    {capturedKeys}
  </button>
);
KeyCaptureButton.displayName = 'KeyCaptureButton';

const KeyDisplayButton: React.FC<{
  readonly binding: Keybinding;
  readonly isModified: boolean;
  readonly onClick: () => void;
}> = ({ binding, isModified, onClick }) => (
  <button
    type="button"
    className={cn(
      'rounded-md border px-3 py-1 text-xs font-mono transition-colors hover:bg-accent',
      isModified ? 'border-primary/50 text-primary' : 'border-input'
    )}
    onClick={onClick}
  >
    {formatBinding(binding)}
  </button>
);
KeyDisplayButton.displayName = 'KeyDisplayButton';

function useKeyCapture(commandId: string, onRebind: ShortcutRowProps['onRebind']) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [capturedKeys, setCapturedKeys] = React.useState('');
  const inputRef = React.useRef<HTMLButtonElement>(null);

  const startEdit = React.useCallback(() => {
    setIsEditing(true);
    setCapturedKeys('Press a key combination...');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!isEditing) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setIsEditing(false);
        setCapturedKeys('');
        return;
      }
      if (MODIFIER_KEYS.has(e.key)) return;
      onRebind(
        commandId,
        e.key.length === 1 ? e.key.toLowerCase() : e.key,
        extractModifiers(e.nativeEvent)
      );
      setIsEditing(false);
      setCapturedKeys('');
    },
    [isEditing, commandId, onRebind]
  );

  const stopBlur = React.useCallback(() => {
    setIsEditing(false);
    setCapturedKeys('');
  }, []);
  return { isEditing, capturedKeys, inputRef, startEdit, handleKeyDown, stopBlur };
}

export const ShortcutRow: React.FC<ShortcutRowProps> = ({
  binding,
  isModified,
  hasConflict,
  onRebind,
  onReset,
}) => {
  const capture = useKeyCapture(binding.commandId, onRebind);
  const handleReset = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onReset(binding.commandId);
    },
    [binding.commandId, onReset]
  );

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md px-3 py-2 text-sm',
        capture.isEditing && 'bg-accent/50 ring-1 ring-ring',
        hasConflict && 'border-l-2 border-l-destructive'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{binding.label}</span>
        {hasConflict ? <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> : null}
      </div>
      <div className="flex items-center gap-2">
        {capture.isEditing ? (
          <KeyCaptureButton
            capturedKeys={capture.capturedKeys}
            inputRef={capture.inputRef}
            onKeyDown={capture.handleKeyDown}
            onBlur={capture.stopBlur}
          />
        ) : (
          <KeyDisplayButton binding={binding} isModified={isModified} onClick={capture.startEdit} />
        )}
        {isModified ? (
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={handleReset}
            aria-label={`Reset ${binding.label} to default`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
};

ShortcutRow.displayName = 'ShortcutRow';
