/**
 * Preview elements whose addresses can navigate or load a local file.
 */

import type { JSX } from 'react';
import type {
  AreaHTMLAttributes,
  BaseHTMLAttributes,
  FormHTMLAttributes,
  LinkHTMLAttributes,
} from 'react';

import { isBlockedPreviewHref } from '../preview-href';

function safeAddress(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && !isBlockedPreviewHref(value)
    ? value
    : undefined;
}

export function Base({ href: _href, ...props }: BaseHTMLAttributes<HTMLBaseElement>): JSX.Element {
  return <base {...props} />;
}

export function Area({ href, ...props }: AreaHTMLAttributes<HTMLAreaElement>): JSX.Element {
  const safeHref = safeAddress(href);
  return <area {...props} {...(safeHref ? { href: safeHref } : {})} />;
}

export function Form({ action, ...props }: FormHTMLAttributes<HTMLFormElement>): JSX.Element {
  const safeAction = safeAddress(action);
  return <form {...props} {...(safeAction ? { action: safeAction } : {})} />;
}

export function Link({ href, ...props }: LinkHTMLAttributes<HTMLLinkElement>): JSX.Element {
  const safeHref = safeAddress(href);
  return <link {...props} {...(safeHref ? { href: safeHref } : {})} />;
}

export const previewNavigationComponents = {
  base: Base,
  area: Area,
  form: Form,
  link: Link,
};
