/**
 * BreadcrumbSegment Component
 *
 * Individual breadcrumb segment with type-specific styling.
 * Supports click navigation.
 *
 * @module renderer/components/breadcrumb/BreadcrumbSegment
 */

import { memo } from 'react';
import { ChevronRight, Folder, FileText, Hash, FolderOpen } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import type { BreadcrumbSegment as BreadcrumbSegmentType } from '@renderer/hooks/useBreadcrumb';

export interface BreadcrumbSegmentProps {
  readonly segment: BreadcrumbSegmentType;
  readonly isLast: boolean;
  readonly onClick?: ((segment: BreadcrumbSegmentType) => void) | undefined;
}

const ICON_MAP = {
  workspace: FolderOpen,
  folder: Folder,
  file: FileText,
  heading: Hash,
} as const;

function BreadcrumbSegmentComponent({ segment, isLast, onClick }: BreadcrumbSegmentProps) {
  const Icon = ICON_MAP[segment.type];

  return (
    <span className="flex items-center gap-0.5" data-testid={`breadcrumb-segment-${segment.type}`}>
      <button
        type="button"
        className={cn(
          'flex items-center gap-1 px-1 py-0.5 rounded-sm text-xs',
          'transition-colors',
          isLast ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
          onClick && 'hover:bg-accent cursor-pointer'
        )}
        onClick={() => onClick?.(segment)}
        disabled={!onClick}
        data-testid={`breadcrumb-btn-${segment.id}`}
      >
        <Icon className="w-3 h-3 flex-shrink-0" />
        <span className="truncate max-w-[120px]">{segment.label}</span>
      </button>
      {!isLast && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
    </span>
  );
}

export const BreadcrumbSegment = memo(BreadcrumbSegmentComponent);
BreadcrumbSegment.displayName = 'BreadcrumbSegment';
