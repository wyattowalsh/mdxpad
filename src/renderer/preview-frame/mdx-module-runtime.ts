import type * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { BuiltInComponents } from './components';
import { embedReplacement, showMediaFallback } from './media-playback';
import { confinePreviewElement } from './preview-href';

interface MDXComponentProps {
  readonly children?: React.ReactNode;
  readonly [key: string]: unknown;
}

export interface MDXContentProps {
  readonly components?: Readonly<Record<string, React.ComponentType<MDXComponentProps>>>;
  readonly frontmatter?: Record<string, unknown>;
}

export interface MDXModule {
  default: React.ComponentType<MDXContentProps>;
}

interface CreateModuleFromCodeOptions {
  readonly forceBlobRuntime?: boolean;
}

/**
 * Creates an MDX module from compiled code string.
 * Uses blob-module evaluation in runtime to preserve CSP (no unsafe-eval).
 * Falls back to Function evaluation in Vitest/happy-dom.
 */
export async function createModuleFromCode(
  code: string,
  options: CreateModuleFromCodeOptions = {}
): Promise<MDXModule> {
  if (
    !options.forceBlobRuntime &&
    (import.meta.env.VITEST || typeof URL.createObjectURL !== 'function')
  ) {
    return createModuleFromCodeWithFunction(code);
  }

  const globalScope = globalThis as Record<string, unknown>;
  const runtimeScopeKey = `__mdxpadPreviewRuntimeScope_${globalThis.crypto.randomUUID()}`;
  const moduleSource = `
    const scope = globalThis[${JSON.stringify(runtimeScopeKey)}];
    function moduleFactory(jsxRuntime, components) {
      const exports = {};
      const module = { exports };
      ${code}
      return module.exports;
    }
    const moduleExports = moduleFactory(scope.jsxRuntime, scope.components);
    export default moduleExports.default;
  `;
  const blobUrl = URL.createObjectURL(new Blob([moduleSource], { type: 'text/javascript' }));
  globalScope[runtimeScopeKey] = {
    jsxRuntime: previewJsxRuntime,
    components: BuiltInComponents,
  };

  try {
    const module = (await import(/* @vite-ignore */ blobUrl)) as {
      readonly default: React.ComponentType<MDXContentProps>;
    };
    return { default: module.default };
  } finally {
    URL.revokeObjectURL(blobUrl);
    Reflect.deleteProperty(globalScope, runtimeScopeKey);
  }
}

function createModuleFromCodeWithFunction(code: string): MDXModule {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- MDX runtime requires dynamic code evaluation
  const moduleFactory = new Function(
    'jsxRuntime',
    'components',
    `
    const exports = {};
    const module = { exports };
    ${code}
    return module.exports;
  `
  );

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Function constructor returns typed module
  return moduleFactory(previewJsxRuntime, BuiltInComponents) as MDXModule;
}

const DROPPED_PREVIEW_TAGS = new Set(['script', 'iframe', 'object', 'frame', 'frameset']);

function droppedPreviewTag(type: React.ElementType): boolean {
  return typeof type === 'string' && DROPPED_PREVIEW_TAGS.has(type.toLowerCase());
}

function elementName(type: React.ElementType): string | null {
  return typeof type === 'string' ? type.toLowerCase() : null;
}

function showsFallback(name: string): boolean {
  return (
    name === 'iframe' ||
    name === 'object' ||
    name === 'canvas' ||
    name === 'video' ||
    name === 'audio'
  );
}

function blockedMedia(type: React.ElementType, props: unknown): boolean {
  const name = elementName(type);
  if ((name !== 'video' && name !== 'audio') || props === null || typeof props !== 'object') {
    return false;
  }
  const record = props as { readonly src?: unknown; readonly children?: unknown };
  return showMediaFallback(record.src, record.children);
}

function fallbackChildren(type: React.ElementType, props: unknown): React.ReactNode {
  const name = elementName(type);
  if (name === null || !showsFallback(name)) {
    return undefined;
  }
  if (!props || typeof props !== 'object' || !('children' in props)) {
    return undefined;
  }
  return (props as { children?: React.ReactNode }).children;
}

function embedNode(type: React.ElementType, props: unknown): React.ReactNode | undefined {
  if (elementName(type) !== 'embed' || props === null || typeof props !== 'object') {
    return undefined;
  }
  const record = props as {
    readonly src?: unknown;
    readonly children?: unknown;
    readonly alt?: unknown;
  };
  const replacement = embedReplacement(record.src, record.children, record.alt);
  return replacement === undefined ? undefined : (replacement as React.ReactNode);
}

function confinedJsx(
  jsx: typeof jsxRuntime.jsx,
  type: React.ElementType,
  props: unknown,
  key?: React.Key
): React.ReactElement {
  const embed = embedNode(type, props);
  const replaced =
    embed !== undefined ||
    droppedPreviewTag(type) ||
    elementName(type) === 'canvas' ||
    blockedMedia(type, props);
  if (replaced) {
    const children = embed !== undefined ? embed : fallbackChildren(type, props);
    const fragmentProps = children === undefined ? {} : { children };
    return key === undefined
      ? jsx(jsxRuntime.Fragment, fragmentProps)
      : jsx(jsxRuntime.Fragment, fragmentProps, key);
  }
  const next = confinePreviewElement(type, props);
  if (key === undefined) {
    return jsx(type, next);
  }
  return jsx(type, next, key);
}

function UnknownMdxComponent(props: MDXComponentProps): React.ReactElement {
  return jsxRuntime.jsx(jsxRuntime.Fragment, { children: props.children });
}

/** Built-in components, with unknown tags rendered as their words. */
export const previewComponents = new Proxy(BuiltInComponents, {
  get(target, prop, receiver): unknown {
    if (typeof prop !== 'string' || prop in target) {
      const value: unknown = Reflect.get(target, prop, receiver);
      return value;
    }
    return UnknownMdxComponent;
  },
});

const previewJsxRuntime = {
  ...jsxRuntime,
  jsx: (type: React.ElementType, props: unknown, key?: React.Key): React.ReactElement =>
    confinedJsx(jsxRuntime.jsx, type, props, key),
  jsxs: (type: React.ElementType, props: unknown, key?: React.Key): React.ReactElement =>
    confinedJsx(jsxRuntime.jsxs, type, props, key),
};
