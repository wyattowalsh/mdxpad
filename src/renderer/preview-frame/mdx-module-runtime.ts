import type * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { BuiltInComponents } from './components';

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
    jsxRuntime,
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
  return moduleFactory(jsxRuntime, BuiltInComponents) as MDXModule;
}
