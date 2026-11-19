/**
 * Tests for Atomic Write utility
 *
 * Covers the atomic file write pattern: temp file creation, rename,
 * error handling, and cleanup.
 *
 * @module shared/lib/__tests__/atomic-write.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, existsSync, lstatSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { atomicWrite, type AtomicWritePhase } from '../atomic-write';

describe('atomicWrite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'atomic-write-test-'));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('happy path', () => {
    it('should write content to target file', async () => {
      const targetPath = join(tempDir, 'output.txt');
      await atomicWrite(targetPath, 'hello world');

      const content = readFileSync(targetPath, 'utf-8');
      expect(content).toBe('hello world');
    });

    it('does not write through a temporary link', async () => {
      const outside = mkdtempSync(join(tmpdir(), 'atomic-write-secret-'));
      const secret = join(outside, 'secret.txt');
      const targetPath = join(tempDir, 'output.txt');
      writeFileSync(secret, 'secret');
      symlinkSync(secret, `${targetPath}.tmp`);

      try {
        await atomicWrite(targetPath, 'hello');
        expect(readFileSync(secret, 'utf-8')).toBe('secret');
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }

      expect(lstatSync(targetPath).isSymbolicLink()).toBe(false);
      expect(readFileSync(targetPath, 'utf-8')).toBe('hello');
    });

    it('replaces a target that is a link', async () => {
      const outside = mkdtempSync(join(tmpdir(), 'atomic-write-target-'));
      const secret = join(outside, 'secret.txt');
      const targetPath = join(tempDir, 'output.txt');
      writeFileSync(secret, 'secret');
      symlinkSync(secret, targetPath);

      try {
        await atomicWrite(targetPath, 'hello');
        expect(readFileSync(secret, 'utf-8')).toBe('secret');
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }

      expect(lstatSync(targetPath).isSymbolicLink()).toBe(false);
      expect(readFileSync(targetPath, 'utf-8')).toBe('hello');
    });

    it('should overwrite existing file', async () => {
      const targetPath = join(tempDir, 'output.txt');
      await atomicWrite(targetPath, 'first');
      await atomicWrite(targetPath, 'second');

      const content = readFileSync(targetPath, 'utf-8');
      expect(content).toBe('second');
    });

    it('should write empty content', async () => {
      const targetPath = join(tempDir, 'empty.txt');
      await atomicWrite(targetPath, '');

      const content = readFileSync(targetPath, 'utf-8');
      expect(content).toBe('');
    });

    it('should write Unicode content', async () => {
      const targetPath = join(tempDir, 'unicode.txt');
      const unicodeContent = '你好世界 🎉 こんにちは';
      await atomicWrite(targetPath, unicodeContent);

      const content = readFileSync(targetPath, 'utf-8');
      expect(content).toBe(unicodeContent);
    });

    it('should write large content', async () => {
      const targetPath = join(tempDir, 'large.txt');
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      await atomicWrite(targetPath, largeContent);

      const content = readFileSync(targetPath, 'utf-8');
      expect(content).toBe(largeContent);
    });

    it('should not leave temp file after successful write', async () => {
      const targetPath = join(tempDir, 'output.txt');
      await atomicWrite(targetPath, 'content');

      const tempPath = `${targetPath}.tmp`;
      expect(existsSync(tempPath)).toBe(false);
    });
  });

  describe('custom temp suffix', () => {
    it('should use custom suffix for temp file', async () => {
      const targetPath = join(tempDir, 'output.txt');
      await atomicWrite(targetPath, 'content', '.bak');

      // File should be written successfully
      const content = readFileSync(targetPath, 'utf-8');
      expect(content).toBe('content');

      // No temp file with custom suffix should remain
      expect(existsSync(`${targetPath}.bak`)).toBe(false);
    });

    it('flushes the finished file before the directory', async () => {
      const targetPath = join(tempDir, 'output.txt');
      const opened: string[] = [];
      const open = fs.open.bind(fs);
      const spy = vi.spyOn(fs, 'open').mockImplementation(async (file, flags) => {
        opened.push(String(file));
        return open(file, flags);
      });

      try {
        await atomicWrite(targetPath, 'hello');
      } finally {
        spy.mockRestore();
      }

      const finished = opened.lastIndexOf(targetPath);
      const directory = opened.lastIndexOf(tempDir);
      expect(finished).toBeGreaterThan(-1);
      expect(directory).toBeGreaterThan(finished);
      expect(readFileSync(targetPath, 'utf-8')).toBe('hello');
    });

    it('flushes the directory after the rename', async () => {
      const targetPath = join(tempDir, 'output.txt');
      const opened: string[] = [];
      const open = fs.open.bind(fs);
      const spy = vi.spyOn(fs, 'open').mockImplementation(async (file, flags) => {
        opened.push(String(file));
        return open(file, flags);
      });

      try {
        await atomicWrite(targetPath, 'hello');
      } finally {
        spy.mockRestore();
      }

      expect(opened).toContain(tempDir);
      expect(readFileSync(targetPath, 'utf-8')).toBe('hello');
    });

    it('keeps the renamed file when the directory flush fails', async () => {
      const targetPath = join(tempDir, 'output.txt');
      const open = fs.open.bind(fs);
      const spy = vi.spyOn(fs, 'open').mockImplementation(async (file, flags) => {
        const handle = await open(file, flags);
        if (String(file) === tempDir) {
          handle.sync = async () => {
            throw Object.assign(new Error('flush failed'), { code: 'EIO' });
          };
        }
        return handle;
      });

      try {
        await expect(atomicWrite(targetPath, 'hello')).rejects.toThrow('flush failed');
      } finally {
        spy.mockRestore();
      }

      expect(readFileSync(targetPath, 'utf-8')).toBe('hello');
    });

    it('finishes the write when a directory cannot be flushed', async () => {
      const targetPath = join(tempDir, 'output.txt');
      const open = fs.open.bind(fs);
      const spy = vi.spyOn(fs, 'open').mockImplementation(async (file, flags) => {
        const handle = await open(file, flags);
        if (String(file) === tempDir) {
          handle.sync = async () => {
            throw Object.assign(new Error('directories are not flushable'), { code: 'EISDIR' });
          };
        }
        return handle;
      });

      try {
        await atomicWrite(targetPath, 'hello');
      } finally {
        spy.mockRestore();
      }

      expect(readFileSync(targetPath, 'utf-8')).toBe('hello');
    });
  });

  describe('durability contract', () => {
    it('should call durability hooks in write/commit order', async () => {
      const targetPath = join(tempDir, 'durability.txt');
      const phases: AtomicWritePhase[] = [];
      const tempPaths: string[] = [];

      await atomicWrite(targetPath, 'content', {
        durabilityContract: {
          onPhase: (phase, context) => {
            phases.push(phase);
            tempPaths.push(context.tempPath);
          },
        },
      });

      expect(phases).toEqual([
        'before-write-temp',
        'after-write-temp',
        'before-commit',
        'after-commit',
      ]);
      expect(tempPaths.every((tempPath) => tempPath === `${targetPath}.tmp`)).toBe(true);
    });

    it('should call durability error hook when write fails', async () => {
      const targetPath = join(tempDir, 'durability-error.txt');
      const onError = vi.fn();

      vi.spyOn(fs, 'writeFile').mockRejectedValue(new Error('Disk full'));

      await expect(
        atomicWrite(targetPath, 'content', {
          durabilityContract: {
            onError,
          },
        })
      ).rejects.toThrow('Disk full');

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          targetPath,
          tempPath: `${targetPath}.tmp`,
        })
      );

      vi.restoreAllMocks();
    });
  });

  describe('error handling', () => {
    it('should throw on write to non-existent directory', async () => {
      const targetPath = join(tempDir, 'nonexistent', 'subdir', 'file.txt');

      await expect(atomicWrite(targetPath, 'content')).rejects.toThrow();
    });

    it('should clean up temp file on write error', async () => {
      // Spy on fs.writeFile to simulate failure after creating temp file
      const originalWriteFile = fs.writeFile;
      const originalUnlink = fs.unlink;

      let tempFileCreated = false;
      const unlinkCalls: string[] = [];

      vi.spyOn(fs, 'writeFile').mockImplementation(async (path, ...args) => {
        tempFileCreated = true;
        // Simulate write failure
        throw new Error('Disk full');
      });

      vi.spyOn(fs, 'unlink').mockImplementation(async (path) => {
        unlinkCalls.push(String(path));
        // Don't actually unlink in mock
      });

      const targetPath = join(tempDir, 'failing.txt');

      await expect(atomicWrite(targetPath, 'content')).rejects.toThrow('Disk full');

      // Should have tried to clean up the temp file
      expect(unlinkCalls).toHaveLength(1);
      expect(unlinkCalls[0]).toBe(`${targetPath}.tmp`);

      vi.restoreAllMocks();
    });

    it('should clean up temp file on rename error', async () => {
      // Create a successful writeFile but failing rename
      const originalRename = fs.rename;
      const unlinkCalls: string[] = [];

      vi.spyOn(fs, 'rename').mockRejectedValue(new Error('Permission denied'));
      vi.spyOn(fs, 'unlink').mockImplementation(async (path) => {
        unlinkCalls.push(String(path));
        // Actually remove the temp file
        return originalRename.call(fs, String(path), `${String(path)}.deleted`).catch(() => {});
      });

      const targetPath = join(tempDir, 'rename-fail.txt');

      await expect(atomicWrite(targetPath, 'content')).rejects.toThrow('Permission denied');

      // Should have tried to clean up
      expect(unlinkCalls.length).toBeGreaterThanOrEqual(1);

      vi.restoreAllMocks();
    });

    it('should not throw if cleanup fails', async () => {
      vi.spyOn(fs, 'writeFile').mockRejectedValue(new Error('Write error'));
      vi.spyOn(fs, 'unlink').mockRejectedValue(new Error('Cleanup error'));

      const targetPath = join(tempDir, 'no-cleanup.txt');

      // Should throw the original error, not the cleanup error
      await expect(atomicWrite(targetPath, 'content')).rejects.toThrow('Write error');

      vi.restoreAllMocks();
    });
  });

  describe('atomicity guarantee', () => {
    it('should not corrupt target if write fails midway', async () => {
      const targetPath = join(tempDir, 'atomic-target.txt');

      // Write initial content
      await atomicWrite(targetPath, 'original content');

      // Make the next write fail during rename
      vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('Rename failed'));

      try {
        await atomicWrite(targetPath, 'new content');
      } catch {
        // Expected to fail
      }

      // Original content should still be intact
      const content = readFileSync(targetPath, 'utf-8');
      expect(content).toBe('original content');

      vi.restoreAllMocks();
    });
  });
});
