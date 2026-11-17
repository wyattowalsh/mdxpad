import { describe, expect, it } from 'vitest';
import { selectSessionCsp, withSessionCsp } from '../session-csp';

const rendererDir = '/app/renderer';

describe('selectSessionCsp', () => {
  it('leaves preview documents on their meta policy', () => {
    expect(
      selectSessionCsp('mdxpad-preview://local/preview-frame/index.html', { rendererDir })
    ).toBeNull();
    expect(
      selectSessionCsp('http://localhost:5173/preview-frame/index.html', {
        rendererDir,
        rendererUrl: 'http://localhost:5173',
      })
    ).toBeNull();
  });

  it('allows Vite HMR on the configured dev origin', () => {
    const policy = selectSessionCsp('http://localhost:5173/index.html', {
      rendererDir,
      rendererUrl: 'http://localhost:5173',
    });
    expect(policy).toContain('http://localhost:5173');
    expect(policy).toContain('ws://localhost:5173');
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("worker-src 'self' blob:");
  });

  it('uses a production policy without unsafe-eval for app files', () => {
    const policy = selectSessionCsp('file:///app/renderer/index.html', { rendererDir });
    expect(policy).toContain("frame-src 'self' mdxpad-preview:");
    expect(policy).toContain("worker-src 'self'");
    expect(policy).not.toContain("worker-src 'self' blob:");
    expect(policy).not.toContain('unsafe-eval');
  });

  it('reads the Vite origin from the environment when options are omitted', () => {
    const previous = process.env.ELECTRON_RENDERER_URL;
    process.env.ELECTRON_RENDERER_URL = 'http://127.0.0.1:4173';
    try {
      const policy = selectSessionCsp('http://127.0.0.1:4173/main.tsx');
      expect(policy).toContain('ws://127.0.0.1:4173');
      expect(policy).toContain('http://127.0.0.1:4173');
      expect(policy).toContain("'unsafe-eval'");
      expect(policy).toContain("worker-src 'self' blob:");
      expect(selectSessionCsp('http://127.0.0.1:9999/')).toBeNull();
      expect(selectSessionCsp('http://evil.test:4173/')).toBeNull();
      expect(selectSessionCsp('http://127.0.0.1:4173/preview-frame/index.html')).toBeNull();
    } finally {
      if (previous === undefined) {
        delete process.env.ELECTRON_RENDERER_URL;
      } else {
        process.env.ELECTRON_RENDERER_URL = previous;
      }
    }
  });
});

describe('withSessionCsp', () => {
  it('replaces an existing CSP header instead of appending one', () => {
    const headers = withSessionCsp(
      { 'content-security-policy': ["default-src 'none'"] },
      "default-src 'self'"
    );
    expect(headers['content-security-policy']).toBeUndefined();
    expect(headers['Content-Security-Policy']).toEqual(["default-src 'self'"]);
  });

  it('replaces every CSP header casing with one value', () => {
    const headers = withSessionCsp(
      {
        'Content-Security-Policy': ["default-src 'none'"],
        'content-security-policy': ["script-src 'unsafe-eval'"],
        'CONTENT-SECURITY-POLICY': ['object-src *'],
        'Content-Security-Policy-Report-Only': ["script-src 'none'"],
        'X-Keep': ['yes'],
      },
      "default-src 'self'"
    );
    expect(
      Object.keys(headers).filter((key) => key.toLowerCase() === 'content-security-policy')
    ).toEqual(['Content-Security-Policy']);
    expect(headers['Content-Security-Policy']).toEqual(["default-src 'self'"]);
    expect(headers['Content-Security-Policy-Report-Only']).toEqual(["script-src 'none'"]);
    expect(headers['X-Keep']).toEqual(['yes']);
  });
});
