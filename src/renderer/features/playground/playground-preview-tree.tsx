/**
 * Turn a small HTML fragment into React elements.
 * Attributes are dropped, and tags outside the allowlist are rejected.
 */

import React from 'react';

const ALLOWED_TAGS = new Set([
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'blockquote',
  'br',
  'hr',
]);

const VOID_TAGS = new Set(['br', 'hr']);

export type PlaygroundTree =
  | { readonly ok: true; readonly element: React.ReactNode }
  | { readonly ok: false; readonly error: string };

function walk(node: ChildNode, key: string): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) {
    throw new Error(`${tag} is not available in the playground preview`);
  }
  if (VOID_TAGS.has(tag)) {
    return React.createElement(tag, { key });
  }
  const children = Array.from(element.childNodes).map((child, index) =>
    walk(child, `${key}-${index}`)
  );
  return React.createElement(tag, { key }, children);
}

export function buildPlaygroundPreview(code: string): PlaygroundTree {
  if (code.trim().length === 0) {
    return { ok: true, element: null };
  }
  try {
    const document = new DOMParser().parseFromString(`<body>${code}</body>`, 'text/html');
    const body = document.body;
    const children = Array.from(body.childNodes).map((child, index) =>
      walk(child, `node-${index}`)
    );
    return { ok: true, element: children };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Preview failed';
    return { ok: false, error: message };
  }
}
