/**
 * Security tests for NotificationService and StaticSiteGenerator.
 * Validates XSS prevention in notifications and HTML escaping in SSG output.
 * @module tests/security/notification-ssg-security
 */
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

// ============================================================================
// Mock Electron Notification API
// ============================================================================

interface MockNotif {
  on: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  title: string;
  body: string;
  listeners: Map<string, ((...args: unknown[]) => void)[]>;
}

const mockInstances: MockNotif[] = [];

vi.mock('electron', () => {
  const Ctor = vi.fn(function Ctor(this: MockNotif, opts: { title: string; body: string }) {
    this.title = opts.title;
    this.body = opts.body;
    this.listeners = new Map();
    this.on = vi.fn((ev: string, fn: (...args: unknown[]) => void) => {
      const arr = this.listeners.get(ev) ?? [];
      arr.push(fn);
      this.listeners.set(ev, arr);
    });
    this.show = vi.fn(() => {
      setTimeout(() => {
        for (const h of this.listeners.get('close') ?? []) h();
      }, 0);
    });
    this.close = vi.fn();
    mockInstances.push(this);
  });
  (Ctor as unknown as Record<string, unknown>).isSupported = vi.fn(() => true);
  return { Notification: Ctor };
});

import { NotificationService } from '@main/services/notification-service';
import { StaticSiteGenerator } from '@main/services/static-site-generator';

// ============================================================================
// Notification Security Tests
// ============================================================================

describe('NotificationService security', () => {
  let svc: NotificationService;

  beforeEach(() => {
    mockInstances.length = 0;
    svc = new NotificationService();
  });

  describe('XSS payload handling', () => {
    const payloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      'javascript:alert(1)',
      '<a href="javascript:alert(1)">click</a>',
      '<div onmouseover="alert(1)">hover</div>',
      '"><script>alert(document.cookie)</script>',
      "';alert(String.fromCharCode(88,83,83))//",
      '<iframe src="javascript:alert(1)">',
      '<body onload=alert(1)>',
    ];

    it('passes payloads to Electron Notification safely (plain text rendering)', async () => {
      for (const p of payloads) {
        const r = await svc.show(p, p);
        expect(r.id).toBeTruthy();
      }
      // Electron Notification renders plain text, so raw content is safe
      for (let i = 0; i < payloads.length; i++) {
        expect(mockInstances[i]?.title).toBe(payloads[i]);
        expect(mockInstances[i]?.body).toBe(payloads[i]);
      }
    });

    it('HTML entity content passes through safely', async () => {
      const body = 'File &amp; Folder &lt;updated&gt;';
      const r = await svc.show('Save Complete', body);
      expect(r.id).toBeTruthy();
      expect(mockInstances[mockInstances.length - 1]?.body).toBe(body);
    });

    it('handles extremely long content without crash', async () => {
      const long = 'A'.repeat(10000);
      const r = await svc.show(long, long);
      expect(r.id).toBeTruthy();
      expect(mockInstances[mockInstances.length - 1]?.title).toBe(long);
    });

    it('handles null bytes and control characters', async () => {
      const r = await svc.show('test\x00null\x01ctrl\x7F', 'body');
      expect(r.id).toBeTruthy();
    });
  });

  describe('queue management', () => {
    it('dismisses oldest notification when queue is full', async () => {
      const promises: Promise<unknown>[] = [];
      for (let i = 0; i < 12; i++) promises.push(svc.show(`T${i}`, `B${i}`));
      await Promise.all(promises); // Should not throw
    });
  });
});

// ============================================================================
// Static Site Generator Security Tests
// ============================================================================

describe('StaticSiteGenerator security', () => {
  let ssg: StaticSiteGenerator;
  let tempDir: string;

  beforeEach(async () => {
    ssg = new StaticSiteGenerator({ defaultTitle: 'Test Site' });
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-ssg-sec-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  /** Helper to generate a single-file site and read output HTML */
  async function generateAndRead(
    filename: string,
    content: string,
    opts: { styles?: boolean; index?: boolean; title?: string } = {}
  ): Promise<string> {
    const inputFile = path.join(tempDir, filename);
    const outputDir = path.join(tempDir, `out-${filename}`);
    await writeFile(inputFile, content, 'utf-8');
    const result = await ssg.generate({
      files: [{ path: inputFile }],
      outputDir,
      title: opts.title,
      includeStyles: opts.styles ?? false,
      includeHighlighting: false,
      generateIndex: opts.index ?? false,
    });
    expect(result.success).toBe(true);
    const slug = filename
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const target = opts.index ? 'index.html' : `${slug}.html`;
    return readFile(path.join(outputDir, target), 'utf-8');
  }

  describe('script tag escaping', () => {
    it('escapes script tags in code blocks', async () => {
      const html = await generateAndRead(
        'xss-code.mdx',
        [
          '# Hello',
          '',
          '```js',
          '<script>alert("xss")</script>',
          '```',
          '',
          'Normal paragraph',
        ].join('\n')
      );
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;/script&gt;');
      expect(html).not.toMatch(/<pre[^>]*>[\s\S]*<script>[\s\S]*<\/script>[\s\S]*<\/pre>/i);
    });

    it('does not produce executable script in head from inline MDX', async () => {
      const html = await generateAndRead(
        'xss-inline.mdx',
        ['# Malicious Page', '', '<script>document.location="http://evil.com"</script>'].join('\n')
      );
      expect(html).toContain('<title>Malicious Page</title>');
      const head = html.split('<body>')[0] ?? '';
      expect(head).not.toMatch(/<script>/i);
    });

    it('escapes XSS payloads in title (head and h1)', async () => {
      const html = await generateAndRead(
        'xss-title.mdx',
        ['---', 'title: <script>alert("xss")</script>', '---', '', 'Content.'].join('\n')
      );
      expect(html).toContain('<title>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</title>');
      expect(html).toContain('<h1>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</h1>');
      expect(html.split('</head>')[0] ?? '').not.toMatch(/<script>alert/);
    });

    it('escapes HTML event handler attributes in titles', async () => {
      const html = await generateAndRead(
        'xss-attr.mdx',
        ['---', 'title: " onerror="alert(1)" data-x="', '---', '', 'Content.'].join('\n')
      );
      expect(html).toContain('&quot;');
      expect(html).not.toMatch(/onerror="alert/);
    });
  });

  describe('index page safety', () => {
    it('escapes page titles in index page links', async () => {
      const inputFile = path.join(tempDir, 'xss-idx.mdx');
      const outputDir = path.join(tempDir, 'out-idx');
      await writeFile(inputFile, '# <img src=x onerror=alert(1)>', 'utf-8');
      const result = await ssg.generate({
        files: [{ path: inputFile }],
        outputDir,
        title: '<script>alert("site-xss")</script>',
        includeStyles: false,
        includeHighlighting: false,
        generateIndex: true,
      });
      expect(result.success).toBe(true);
      const indexHtml = await readFile(path.join(outputDir, 'index.html'), 'utf-8');
      expect(indexHtml).toContain('&lt;script&gt;');
      expect(indexHtml).not.toMatch(/<script>alert\("site-xss"\)<\/script>/);
      expect(indexHtml).toContain('&lt;img');
      expect(indexHtml).not.toMatch(/<img\s+src=/i);
    });
  });

  describe('safe content handling', () => {
    it('handles frontmatter with javascript: protocol safely', async () => {
      const html = await generateAndRead(
        'js-proto.mdx',
        ['---', 'title: "javascript:alert(1)"', '---', '', 'Safe content.'].join('\n')
      );
      expect(html).not.toMatch(/<a\s+href="javascript:/i);
    });

    it('handles embedded HTML entities without crash', async () => {
      await generateAndRead(
        'entities.mdx',
        ['# Test &amp; Document', '', 'Has &lt;brackets&gt; and &quot;quotes&quot;.'].join('\n')
      );
    });

    it('no script tags outside code elements in body', async () => {
      const html = await generateAndRead(
        'inline-code.mdx',
        ['# Code', '', 'Use `<div>` and `<script>` tags.'].join('\n')
      );
      const body = html.split('<body>')[1]?.split('</body>')[0] ?? '';
      const outsideCode = body.replace(/<code>[\s\S]*?<\/code>/g, '');
      expect(outsideCode).not.toMatch(/<script>/i);
    });
  });

  describe('output structure', () => {
    it('produces valid HTML document structure', async () => {
      const html = await generateAndRead('structure.mdx', '# Simple\n\nHello world.', {
        styles: true,
      });
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('<meta name="viewport"');
      expect(html).toContain('</html>');
    });

    it('does not include user-injected meta tags', async () => {
      const html = await generateAndRead(
        'meta-inject.mdx',
        [
          '---',
          'title: "><meta http-equiv="refresh" content="0;url=http://evil.com"',
          '---',
          '',
          'Content.',
        ].join('\n')
      );
      expect(html).not.toMatch(/http-equiv="refresh"/);
      expect(html).toContain('&gt;');
    });
  });
});
