import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentType } from 'react';

interface MDXModule {
  default: ComponentType;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
}

const mocks = vi.hoisted(() => ({
  rootRender: vi.fn<(element: unknown) => void>(),
  createRoot: vi.fn(),
  createModuleFromCode: vi.fn<(code: string) => Promise<MDXModule>>(),
  requestMermaidRender: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  createRoot: mocks.createRoot,
}));

vi.mock('../mdx-module-runtime', () => ({
  createModuleFromCode: mocks.createModuleFromCode,
}));

vi.mock('../mermaid-render-scheduler', () => ({
  createMermaidRenderScheduler: vi.fn(() => ({
    requestRender: mocks.requestMermaidRender,
  })),
}));

vi.mock('@shared/security', () => ({
  createSecureMessageHandler: vi.fn(
    (
      _config: unknown,
      _validate: unknown,
      onValidatedMessage: (message: unknown, event: MessageEvent) => void
    ) =>
      (event: MessageEvent): void => {
        onValidatedMessage(event.data, event);
      }
  ),
  validateParentToIframeMessage: vi.fn(),
  createRateLimiter: vi.fn(() => ({ canProceed: () => true })),
  sanitizeErrorMessage: vi.fn((message: string) => message),
  sanitizeComponentStack: vi.fn((stack: string) => stack),
}));

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('preview-frame renderer', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      }
    );
    document.body.innerHTML = '<div id="root"></div>';

    mocks.rootRender.mockReset();
    mocks.createRoot.mockReset();
    mocks.createRoot.mockReturnValue({ render: mocks.rootRender });
    mocks.createModuleFromCode.mockReset();
    mocks.requestMermaidRender.mockReset();

    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('keeps the latest render when an older async render resolves last', async () => {
    const olderRender = createDeferred<MDXModule>();
    const newerRender = createDeferred<MDXModule>();
    const oldComponent = (): null => null;
    const newComponent = (): null => null;

    mocks.createModuleFromCode.mockImplementation((code: string): Promise<MDXModule> => {
      if (code === 'old-code') {
        return olderRender.promise;
      }
      if (code === 'new-code') {
        return newerRender.promise;
      }
      return Promise.reject(new Error(`Unexpected code: ${code}`));
    });

    await import('../renderer');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    const oldMessage = new MessageEvent('message', {
      data: { type: 'render', code: 'old-code', frontmatter: { version: 'old' } },
    });
    Object.defineProperty(oldMessage, 'source', { value: window.parent });
    expect(oldMessage.source).toBe(window.parent);
    window.dispatchEvent(oldMessage);

    const newMessage = new MessageEvent('message', {
      data: { type: 'render', code: 'new-code', frontmatter: { version: 'new' } },
    });
    Object.defineProperty(newMessage, 'source', { value: window.parent });
    expect(newMessage.source).toBe(window.parent);
    window.dispatchEvent(newMessage);

    newerRender.resolve({ default: newComponent });
    await flushMicrotasks();
    expect(mocks.rootRender).toHaveBeenCalledTimes(1);

    olderRender.resolve({ default: oldComponent });
    await flushMicrotasks();
    expect(mocks.rootRender).toHaveBeenCalledTimes(1);

    const lastRenderCall = mocks.rootRender.mock.calls.at(-1)?.[0] as {
      props?: {
        children?: {
          type?: ComponentType;
          props?: {
            frontmatter?: Record<string, unknown>;
          };
        };
      };
    };

    expect(lastRenderCall.props?.children?.type).toBe(newComponent);
    expect(lastRenderCall.props?.children?.props?.frontmatter).toEqual({ version: 'new' });
  });
});
