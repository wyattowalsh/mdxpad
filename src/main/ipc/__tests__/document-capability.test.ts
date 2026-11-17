import { beforeEach, describe, expect, it, vi } from 'vitest';

const { realpathSyncMock } = vi.hoisted(() => ({
  realpathSyncMock: vi.fn((target: string) => target),
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    realpathSync: ((target: string) => realpathSyncMock(target)) as typeof actual.realpathSync,
  };
});

import {
  canBootstrapReadCapability,
  grantReadCapability,
  grantWriteCapability,
  hasReadCapability,
  hasWriteCapability,
  normalizeCapabilityPath,
  resetFileCapabilities,
} from '../document-capability';

function missingPath(code = 'ENOENT'): Error {
  return Object.assign(new Error(code), { code });
}

describe('document capability paths', () => {
  beforeEach(() => {
    resetFileCapabilities();
    realpathSyncMock.mockReset();
    realpathSyncMock.mockImplementation((target: string) => target);
  });

  it('rejects empty paths and paths that contain NUL', () => {
    expect(normalizeCapabilityPath('')).toBeNull();
    expect(normalizeCapabilityPath('a\0b')).toBeNull();
    expect(realpathSyncMock).not.toHaveBeenCalled();
  });

  it('treats a symlink path and its real path as one grant', () => {
    realpathSyncMock.mockImplementation((target: string) => {
      if (target === '/tmp/a.mdx' || target === '/private/tmp/a.mdx') {
        return '/private/tmp/a.mdx';
      }
      return target;
    });

    grantWriteCapability('/tmp/a.mdx');

    expect(hasWriteCapability('/private/tmp/a.mdx')).toBe(true);
    expect(hasReadCapability('/private/tmp/a.mdx')).toBe(true);
    expect(hasWriteCapability('/tmp/a.mdx')).toBe(true);
  });

  it('canonicalizes a missing file through its parent directory', () => {
    realpathSyncMock.mockImplementation((target: string) => {
      if (target === '/tmp/new.mdx' || target === '/private/tmp/new.mdx') {
        throw missingPath();
      }
      if (target === '/tmp' || target === '/private/tmp') {
        return '/private/tmp';
      }
      throw missingPath();
    });

    expect(normalizeCapabilityPath('/tmp/new.mdx')).toBe('/private/tmp/new.mdx');

    grantWriteCapability('/tmp/new.mdx');

    expect(hasWriteCapability('/private/tmp/new.mdx')).toBe(true);
    expect(hasReadCapability('/tmp/new.mdx')).toBe(true);
  });

  it('does not grant the unresolved path when the parent cannot be canonicalized', () => {
    realpathSyncMock.mockImplementation(() => {
      throw missingPath();
    });

    expect(normalizeCapabilityPath('/missing/parent/file.mdx')).toBeNull();

    grantWriteCapability('/missing/parent/file.mdx');

    expect(hasWriteCapability('/missing/parent/file.mdx')).toBe(false);
    expect(hasReadCapability('/missing/parent/file.mdx')).toBe(false);
  });

  it('denies when realpath fails for a reason other than a missing file', () => {
    realpathSyncMock.mockImplementation((target: string) => {
      if (target === '/secret/file.mdx') {
        throw missingPath('EACCES');
      }
      if (target === '/secret') {
        return '/secret';
      }
      return target;
    });

    expect(normalizeCapabilityPath('/secret/file.mdx')).toBeNull();
    grantWriteCapability('/secret/file.mdx');
    expect(hasWriteCapability('/secret/file.mdx')).toBe(false);
  });

  it('bootstraps only a canonical schema sidecar for a granted document directory', () => {
    realpathSyncMock.mockImplementation((target: string) => {
      const canonical: Record<string, string> = {
        '/docs/note.mdx': '/private/docs/note.mdx',
        '/private/docs/note.mdx': '/private/docs/note.mdx',
        '/docs/.mdxpad/schema.json': '/private/docs/.mdxpad/schema.json',
        '/private/docs/.mdxpad/schema.json': '/private/docs/.mdxpad/schema.json',
      };
      const mapped = canonical[target];
      if (mapped === undefined) {
        throw missingPath();
      }
      return mapped;
    });

    expect(canBootstrapReadCapability('/docs/note.mdx')).toBe(false);
    expect(canBootstrapReadCapability('/docs/note.md')).toBe(false);
    expect(canBootstrapReadCapability('/docs/note.txt')).toBe(false);

    grantReadCapability('/docs/note.mdx');

    expect(canBootstrapReadCapability('/docs/.mdxpad/schema.json')).toBe(true);
    expect(hasReadCapability('/docs/.mdxpad/schema.json')).toBe(true);
    expect(canBootstrapReadCapability('/elsewhere/.mdxpad/schema.json')).toBe(false);
  });
});
