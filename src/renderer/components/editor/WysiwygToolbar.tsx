/**
 * WYSIWYG Toolbar Component
 *
 * Formatting toolbar for the ProseMirror WYSIWYG editor.
 * Includes buttons for bold, italic, code, headings, lists, and inserts.
 *
 * @module renderer/components/editor/WysiwygToolbar
 */

import * as React from 'react';
import {
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link,
  Image,
  Strikethrough,
} from 'lucide-react';
import { cn } from '@shared/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface ToolbarAction {
  readonly id: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly action: () => void;
  readonly isActive?: boolean | undefined;
  readonly group: string;
}

export interface WysiwygToolbarProps {
  readonly actions: readonly ToolbarAction[];
  readonly className?: string;
}

// =============================================================================
// DEFAULT ACTIONS FACTORY
// =============================================================================

export interface ToolbarCallbacks {
  readonly onBold: () => void;
  readonly onItalic: () => void;
  readonly onStrikethrough: () => void;
  readonly onCode: () => void;
  readonly onHeading: (level: number) => void;
  readonly onBulletList: () => void;
  readonly onOrderedList: () => void;
  readonly onBlockquote: () => void;
  readonly onHorizontalRule: () => void;
  readonly onLink: () => void;
  readonly onImage: () => void;
  readonly isBold?: boolean;
  readonly isItalic?: boolean;
  readonly isStrikethrough?: boolean;
  readonly isCode?: boolean;
  readonly isBulletList?: boolean;
  readonly isOrderedList?: boolean;
  readonly isBlockquote?: boolean;
}

/**
 * Create default toolbar actions from callbacks.
 */
export function createDefaultActions(cb: ToolbarCallbacks): ToolbarAction[] {
  return [
    {
      id: 'bold',
      label: 'Bold',
      icon: <Bold className="h-4 w-4" />,
      action: cb.onBold,
      isActive: cb.isBold,
      group: 'format',
    },
    {
      id: 'italic',
      label: 'Italic',
      icon: <Italic className="h-4 w-4" />,
      action: cb.onItalic,
      isActive: cb.isItalic,
      group: 'format',
    },
    {
      id: 'strikethrough',
      label: 'Strikethrough',
      icon: <Strikethrough className="h-4 w-4" />,
      action: cb.onStrikethrough,
      isActive: cb.isStrikethrough,
      group: 'format',
    },
    {
      id: 'code',
      label: 'Inline Code',
      icon: <Code className="h-4 w-4" />,
      action: cb.onCode,
      isActive: cb.isCode,
      group: 'format',
    },
    {
      id: 'h1',
      label: 'Heading 1',
      icon: <Heading1 className="h-4 w-4" />,
      action: () => cb.onHeading(1),
      group: 'heading',
    },
    {
      id: 'h2',
      label: 'Heading 2',
      icon: <Heading2 className="h-4 w-4" />,
      action: () => cb.onHeading(2),
      group: 'heading',
    },
    {
      id: 'h3',
      label: 'Heading 3',
      icon: <Heading3 className="h-4 w-4" />,
      action: () => cb.onHeading(3),
      group: 'heading',
    },
    {
      id: 'bullet-list',
      label: 'Bullet List',
      icon: <List className="h-4 w-4" />,
      action: cb.onBulletList,
      isActive: cb.isBulletList,
      group: 'list',
    },
    {
      id: 'ordered-list',
      label: 'Ordered List',
      icon: <ListOrdered className="h-4 w-4" />,
      action: cb.onOrderedList,
      isActive: cb.isOrderedList,
      group: 'list',
    },
    {
      id: 'blockquote',
      label: 'Blockquote',
      icon: <Quote className="h-4 w-4" />,
      action: cb.onBlockquote,
      isActive: cb.isBlockquote,
      group: 'block',
    },
    {
      id: 'hr',
      label: 'Horizontal Rule',
      icon: <Minus className="h-4 w-4" />,
      action: cb.onHorizontalRule,
      group: 'block',
    },
    {
      id: 'link',
      label: 'Link',
      icon: <Link className="h-4 w-4" />,
      action: cb.onLink,
      group: 'insert',
    },
    {
      id: 'image',
      label: 'Image',
      icon: <Image className="h-4 w-4" />,
      action: cb.onImage,
      group: 'insert',
    },
  ];
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Group toolbar actions by their group property.
 */
function groupActions(actions: readonly ToolbarAction[]): [string, ToolbarAction[]][] {
  const map = new Map<string, ToolbarAction[]>();
  for (const action of actions) {
    const existing = map.get(action.group);
    if (existing) {
      existing.push(action);
    } else {
      map.set(action.group, [action]);
    }
  }
  return [...map.entries()];
}

const ToolbarButton: React.FC<{ readonly action: ToolbarAction }> = ({ action }) => (
  <button
    type="button"
    className={cn(
      'inline-flex h-7 w-7 items-center justify-center rounded-sm transition-colors',
      'hover:bg-accent hover:text-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      action.isActive && 'bg-accent text-accent-foreground'
    )}
    onClick={action.action}
    title={action.label}
    aria-label={action.label}
    aria-pressed={action.isActive}
  >
    {action.icon}
  </button>
);
ToolbarButton.displayName = 'ToolbarButton';

export const WysiwygToolbar: React.FC<WysiwygToolbarProps> = ({ actions, className }) => {
  const groups = React.useMemo(() => groupActions(actions), [actions]);

  return (
    <div
      className={cn('flex items-center gap-0.5 border-b bg-muted/30 px-2 py-1', className)}
      role="toolbar"
      aria-label="Text formatting"
    >
      {groups.map(([group, grpActions], groupIdx) => (
        <React.Fragment key={group}>
          {groupIdx > 0 ? <div className="mx-1 h-5 w-px bg-border" aria-hidden /> : null}
          {grpActions.map((action) => (
            <ToolbarButton key={action.id} action={action} />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

WysiwygToolbar.displayName = 'WysiwygToolbar';
