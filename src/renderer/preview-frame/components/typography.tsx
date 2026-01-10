/**
 * Typography Components
 *
 * MDX-compatible replacements for standard HTML elements.
 * Provides consistent styling and behavior for rendered MDX content.
 * @module preview-frame/components/typography
 */

import * as React from 'react';

/* ============================================================================
   Type Definitions
   ============================================================================ */

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode;
}

interface ParagraphProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

interface AnchorProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children?: React.ReactNode;
}

interface ListProps extends React.HTMLAttributes<HTMLUListElement | HTMLOListElement> {
  children?: React.ReactNode;
}

interface ListItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  children?: React.ReactNode;
}

interface BlockquoteProps extends React.BlockquoteHTMLAttributes<HTMLQuoteElement> {
  children?: React.ReactNode;
}

interface HorizontalRuleProps extends React.HTMLAttributes<HTMLHRElement> {}

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children?: React.ReactNode;
}

interface TableSectionProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children?: React.ReactNode;
}

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children?: React.ReactNode;
}

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
}

interface TableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
}

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Alt text is required for accessibility - defaults to empty string for decorative images */
  alt?: string;
}

/* ============================================================================
   Utility Functions
   ============================================================================ */

/**
 * Determines if a URL is external (different origin).
 */
function isExternalUrl(href: string | undefined): boolean {
  if (!href) return false;
  try {
    const url = new URL(href, window.location.origin);
    return url.origin !== window.location.origin;
  } catch {
    // Relative URLs or invalid URLs are not external
    return false;
  }
}

/* ============================================================================
   Heading Components
   ============================================================================ */

export function H1({ children, className = '', ...props }: HeadingProps): React.ReactNode {
  return (
    <h1 className={`mdx-h1 ${className}`.trim()} {...props}>
      {children}
    </h1>
  );
}

export function H2({ children, className = '', ...props }: HeadingProps): React.ReactNode {
  return (
    <h2 className={`mdx-h2 ${className}`.trim()} {...props}>
      {children}
    </h2>
  );
}

export function H3({ children, className = '', ...props }: HeadingProps): React.ReactNode {
  return (
    <h3 className={`mdx-h3 ${className}`.trim()} {...props}>
      {children}
    </h3>
  );
}

export function H4({ children, className = '', ...props }: HeadingProps): React.ReactNode {
  return (
    <h4 className={`mdx-h4 ${className}`.trim()} {...props}>
      {children}
    </h4>
  );
}

export function H5({ children, className = '', ...props }: HeadingProps): React.ReactNode {
  return (
    <h5 className={`mdx-h5 ${className}`.trim()} {...props}>
      {children}
    </h5>
  );
}

export function H6({ children, className = '', ...props }: HeadingProps): React.ReactNode {
  return (
    <h6 className={`mdx-h6 ${className}`.trim()} {...props}>
      {children}
    </h6>
  );
}

/* ============================================================================
   Text Components
   ============================================================================ */

export function P({ children, className = '', ...props }: ParagraphProps): React.ReactNode {
  return (
    <p className={`mdx-p ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}

export function A({ children, href, className = '', ...props }: AnchorProps): React.ReactNode {
  const isExternal = isExternalUrl(href);

  return (
    <a
      href={href}
      className={`mdx-a ${className}`.trim()}
      {...(isExternal && {
        target: '_blank',
        rel: 'noopener noreferrer',
      })}
      {...props}
    >
      {children}
    </a>
  );
}

/* ============================================================================
   List Components
   ============================================================================ */

export function Ul({ children, className = '', ...props }: ListProps): React.ReactNode {
  return (
    <ul className={`mdx-ul ${className}`.trim()} {...props}>
      {children}
    </ul>
  );
}

export function Ol({ children, className = '', ...props }: ListProps): React.ReactNode {
  return (
    <ol className={`mdx-ol ${className}`.trim()} {...props}>
      {children}
    </ol>
  );
}

export function Li({ children, className = '', ...props }: ListItemProps): React.ReactNode {
  return (
    <li className={`mdx-li ${className}`.trim()} {...props}>
      {children}
    </li>
  );
}

/* ============================================================================
   Block Components
   ============================================================================ */

export function Blockquote({
  children,
  className = '',
  ...props
}: BlockquoteProps): React.ReactNode {
  return (
    <blockquote className={`mdx-blockquote ${className}`.trim()} {...props}>
      {children}
    </blockquote>
  );
}

export function Hr({ className = '', ...props }: HorizontalRuleProps): React.ReactNode {
  return <hr className={`mdx-hr ${className}`.trim()} {...props} />;
}

/* ============================================================================
   Image Component
   ============================================================================ */

/**
 * Accessible image component with enforced alt text.
 * If alt is missing, logs a warning and renders with role="presentation".
 */
export function Img({ alt, className = '', src, ...props }: ImageProps): React.ReactNode {
  // Warn in development if alt text is missing
  if (process.env.NODE_ENV === 'development' && !alt && alt !== '') {
    console.warn(
      'Image is missing alt text. Please provide an alt attribute for accessibility.',
      { src }
    );
  }

  // If alt is explicitly empty string, treat as decorative
  const isDecorative = alt === '';

  return (
    <img
      src={src}
      alt={alt ?? ''}
      className={`mdx-img ${className}`.trim()}
      {...(isDecorative && { role: 'presentation', 'aria-hidden': true })}
      {...props}
    />
  );
}

/* ============================================================================
   Table Components
   ============================================================================ */

export function Table({ children, className = '', ...props }: TableProps): React.ReactNode {
  return (
    <table className={`mdx-table ${className}`.trim()} {...props}>
      {children}
    </table>
  );
}

export function Thead({ children, className = '', ...props }: TableSectionProps): React.ReactNode {
  return (
    <thead className={`mdx-thead ${className}`.trim()} {...props}>
      {children}
    </thead>
  );
}

export function Tbody({ children, className = '', ...props }: TableSectionProps): React.ReactNode {
  return (
    <tbody className={`mdx-tbody ${className}`.trim()} {...props}>
      {children}
    </tbody>
  );
}

export function Tr({ children, className = '', ...props }: TableRowProps): React.ReactNode {
  return (
    <tr className={`mdx-tr ${className}`.trim()} {...props}>
      {children}
    </tr>
  );
}

export function Th({ children, className = '', ...props }: TableHeaderCellProps): React.ReactNode {
  return (
    <th className={`mdx-th ${className}`.trim()} {...props}>
      {children}
    </th>
  );
}

export function Td({ children, className = '', ...props }: TableCellProps): React.ReactNode {
  return (
    <td className={`mdx-td ${className}`.trim()} {...props}>
      {children}
    </td>
  );
}

/* ============================================================================
   Exported Component Map
   ============================================================================ */

/**
 * MDX-compatible typography components map.
 * Use this object to provide component overrides to MDXProvider.
 */
export const typographyComponents = {
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  h5: H5,
  h6: H6,
  p: P,
  a: A,
  ul: Ul,
  ol: Ol,
  li: Li,
  blockquote: Blockquote,
  hr: Hr,
  img: Img,
  table: Table,
  thead: Thead,
  tbody: Tbody,
  tr: Tr,
  th: Th,
  td: Td,
};
