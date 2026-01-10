/**
 * Callout Component
 *
 * Displays highlighted content blocks with variant-based styling.
 * Supports info, warning, error, success, note, and tip variants.
 * @module preview-frame/components/Callout
 */

import * as React from 'react';

/** Callout variant types */
export type CalloutVariant = 'info' | 'warning' | 'error' | 'success' | 'note' | 'tip';

/** Props for the Callout component */
export interface CalloutProps {
  /** Callout variant determining color and icon */
  readonly type?: CalloutVariant;
  /** Optional custom title (defaults based on type) */
  readonly title?: string;
  /** Content */
  readonly children: React.ReactNode;
  /** CSS class */
  readonly className?: string;
}

/** Default titles for each variant */
const DEFAULT_TITLES: Readonly<Record<CalloutVariant, string>> = {
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
  success: 'Success',
  note: 'Note',
  tip: 'Tip',
};

/** Icons for each variant (Unicode/emoji) */
const VARIANT_ICONS: Readonly<Record<CalloutVariant, string>> = {
  info: '\u2139\uFE0F',      // ℹ️
  warning: '\u26A0\uFE0F',   // ⚠️
  error: '\u274C',           // ❌
  success: '\u2705',         // ✅
  note: '\uD83D\uDCDD',      // 📝
  tip: '\uD83D\uDCA1',       // 💡
};

/**
 * Callout component for displaying highlighted content blocks.
 *
 * @example
 * ```tsx
 * <Callout type="warning" title="Caution">
 *   Be careful with this operation.
 * </Callout>
 * ```
 */
export function Callout({
  type = 'info',
  title,
  children,
  className,
}: CalloutProps): React.ReactElement {
  const displayTitle = title ?? DEFAULT_TITLES[type];
  const icon = VARIANT_ICONS[type];
  const variantClass = `callout-${type}`;

  const classNames = ['callout', variantClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <aside
      className={classNames}
      role="note"
      aria-label={displayTitle}
    >
      <div className="callout-header">
        <span className="callout-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="callout-title">{displayTitle}</span>
      </div>
      <div className="callout-content">{children}</div>
    </aside>
  );
}

export default Callout;
