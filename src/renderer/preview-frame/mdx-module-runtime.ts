import type * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { BuiltInComponents } from './components';
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

const DROPPED_PREVIEW_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'frame',
  'frameset',
]);

function droppedPreviewTag(type: React.ElementType): boolean {
  return typeof type === 'string' && DROPPED_PREVIEW_TAGS.has(type.toLowerCase());
}

function fallbackChildren(type: React.ElementType, props: unknown): React.ReactNode {
  if (typeof type !== 'string') {
    return undefined;
  }
  const name = type.toLowerCase();
  if (name !== 'iframe' && name !== 'object' && name !== 'canvas') {
    return undefined;
  }
  if (!props || typeof props !== 'object' || !('children' in props)) {
    return undefined;
  }
  return (props as { children?: React.ReactNode }).children;
}

function confinedJsx(
  jsx: typeof jsxRuntime.jsx,
  type: React.ElementType,
  props: unknown,
  key?: React.Key
): React.ReactElement {
  if (droppedPreviewTag(type) || (typeof type === 'string' && type.toLowerCase() === 'canvas')) {
    const children = fallbackChildren(type, props);
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
