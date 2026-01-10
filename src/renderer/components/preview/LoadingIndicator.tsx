/**
 * Loading Indicator Component
 *
 * Displays a loading spinner when MDX is being compiled.
 * Shows after 100ms delay to avoid flicker for fast compilations.
 * Includes skeleton loader variant for better perceived performance.
 * @module renderer/components/preview/LoadingIndicator
 */

import * as React from 'react';
import { memo, useEffect, useState, useMemo } from 'react';

export interface LoadingIndicatorProps {
  /** Whether the loading indicator should be visible */
  readonly isLoading: boolean;
  /** Delay in ms before showing indicator (default: 100) */
  readonly delay?: number;
  /** Display variant: 'spinner' (default) or 'skeleton' */
  readonly variant?: 'spinner' | 'skeleton';
  /** Custom loading message */
  readonly message?: string;
  /** Additional CSS class */
  readonly className?: string;
}

/** Spinner SVG component - memoized to prevent re-renders */
const SpinnerSvg = memo(function SpinnerSvg(): React.ReactNode {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <title>Loading spinner</title>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
});

/**
 * Skeleton loader component for better perceived performance.
 * Shows placeholder content while MDX is being compiled.
 */
const SkeletonLoader = memo(function SkeletonLoader(): React.ReactNode {
  return (
    <div className="preview-skeleton" aria-hidden="true">
      <div className="preview-skeleton-line preview-skeleton-line--heading" />
      <div className="preview-skeleton-line preview-skeleton-line--text" />
      <div className="preview-skeleton-line preview-skeleton-line--text" />
      <div className="preview-skeleton-line preview-skeleton-line--text" />
      <div className="preview-skeleton-line preview-skeleton-line--text" />
      <div className="preview-skeleton-line preview-skeleton-line--short" />
      <div className="preview-skeleton-block" />
      <div className="preview-skeleton-line preview-skeleton-line--text" />
      <div className="preview-skeleton-line preview-skeleton-line--text" />
    </div>
  );
});

/**
 * Loading indicator with delayed display to prevent flicker.
 * Per spec: 100ms delay to avoid flicker for fast compilations.
 * Supports spinner and skeleton variants for different UX needs.
 * Wrapped in React.memo to prevent unnecessary re-renders from parent.
 */
export const LoadingIndicator = memo(function LoadingIndicator({
  isLoading,
  delay = 100,
  variant = 'spinner',
  message = 'Compiling MDX...',
  className = '',
}: LoadingIndicatorProps): React.ReactNode {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowLoading(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [isLoading, delay]);

  // Memoize class name computation
  const containerClassName = useMemo(
    () => `preview-loading ${className}`.trim(),
    [className]
  );

  const skeletonClassName = useMemo(
    () => `preview-loading-container ${className}`.trim(),
    [className]
  );

  if (!showLoading) {
    return null;
  }

  if (variant === 'skeleton') {
    return (
      <div
        className={skeletonClassName}
        role="status"
        aria-label={message}
      >
        <SkeletonLoader />
        <span className="sr-only">{message}</span>
      </div>
    );
  }

  return (
    <div
      className={containerClassName}
      role="status"
      aria-label={message}
    >
      <div className="preview-loading-spinner" aria-hidden="true">
        <SpinnerSvg />
      </div>
      <span className="preview-loading-text">{message}</span>
    </div>
  );
});

export default LoadingIndicator;
