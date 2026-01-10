/**
 * Card and CardGrid Components
 *
 * Link cards in grid layout with optional icons.
 * Per FR-013: Card component displays title, description, optional icon,
 * and optional link destination.
 * @module preview-frame/components/Card
 */

import * as React from 'react';

/**
 * Props for the Card component
 */
export interface CardProps {
  /** Card title */
  readonly title: string;
  /** Link destination */
  readonly href?: string;
  /** Optional icon element */
  readonly icon?: React.ReactNode;
  /** Card description/content */
  readonly children?: React.ReactNode;
  /** CSS class */
  readonly className?: string;
}

/**
 * Props for the CardGrid component
 */
export interface CardGridProps {
  /** Number of columns (default: 2) */
  readonly columns?: 1 | 2 | 3 | 4;
  /** Card elements */
  readonly children: React.ReactNode;
  /** CSS class */
  readonly className?: string;
}

/**
 * Card component for displaying linked content with title, description, and optional icon.
 * Renders as anchor when href is provided, otherwise renders as div.
 *
 * @example
 * ```tsx
 * <Card title="Getting Started" href="/docs/start" icon={<BookIcon />}>
 *   Learn the basics of mdxpad
 * </Card>
 * ```
 */
export function Card({
  title,
  href,
  icon,
  children,
  className,
}: CardProps): React.ReactElement {
  const isClickable = Boolean(href);

  const cardClasses = [
    'card',
    isClickable && 'card--clickable',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <div className="card-header">
        {icon && <span className="card-icon">{icon}</span>}
        <h3 className="card-title">{title}</h3>
      </div>
      {children && <div className="card-description">{children}</div>}
    </>
  );

  if (href) {
    return (
      <a href={href} className={cardClasses}>
        {content}
      </a>
    );
  }

  return <div className={cardClasses}>{content}</div>;
}

/**
 * CardGrid component for arranging cards in a responsive grid layout.
 * Uses CSS Grid with configurable column count.
 *
 * @example
 * ```tsx
 * <CardGrid columns={3}>
 *   <Card title="One" href="/one">First card</Card>
 *   <Card title="Two" href="/two">Second card</Card>
 *   <Card title="Three" href="/three">Third card</Card>
 * </CardGrid>
 * ```
 */
export function CardGrid({
  columns = 2,
  children,
  className,
}: CardGridProps): React.ReactElement {
  const gridClasses = [
    'card-grid',
    `card-grid--${columns}cols`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={gridClasses} data-columns={columns}>
      {children}
    </div>
  );
}

export default Card;
