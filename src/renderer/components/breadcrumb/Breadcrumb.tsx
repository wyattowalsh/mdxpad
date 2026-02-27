/**
 * Breadcrumb Component
 *
 * Path breadcrumb navigation showing workspace > folder path > file > heading.
 * Each segment is clickable for navigation.
 *
 * @module renderer/components/breadcrumb/Breadcrumb
 */

import { memo } from 'react';
import { cn } from '@shared/lib/utils';
import { useBreadcrumb } from '@renderer/hooks/useBreadcrumb';
import type { BreadcrumbSegment as BreadcrumbSegmentType } from '@renderer/hooks/useBreadcrumb';
import { BreadcrumbSegment } from './BreadcrumbSegment';

export interface BreadcrumbProps {
  readonly onSegmentClick?: (segment: BreadcrumbSegmentType) => void;
  readonly className?: string;
}

function BreadcrumbComponent({ onSegmentClick, className }: BreadcrumbProps) {
  const segments = useBreadcrumb();

  if (segments.length === 0) return null;

  return (
    <nav
      className={cn(
        'flex items-center gap-0.5 px-3 py-1 overflow-x-auto',
        'select-none',
        className
      )}
      aria-label="Breadcrumb navigation"
      data-testid="breadcrumb"
    >
      {segments.map((segment, index) => (
        <BreadcrumbSegment
          key={segment.id}
          segment={segment}
          isLast={index === segments.length - 1}
          onClick={onSegmentClick}
        />
      ))}
    </nav>
  );
}

export const Breadcrumb = memo(BreadcrumbComponent);
Breadcrumb.displayName = 'Breadcrumb';
