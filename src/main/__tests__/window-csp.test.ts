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
    expect(policy).toContain('mdxpad-preview:');
    expect(policy).not.toContain('unsafe-eval');
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
});
