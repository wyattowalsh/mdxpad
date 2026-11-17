/**
 * Static Site Generator — Converts MDX files to standalone HTML pages.
 * Generates a publishable static site from MDX document content.
 *
 * @module main/services/static-site-generator
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import type {
  PublishConfig,
  PublishProgress,
  PublishResult,
} from '@shared/contracts/share-schemas';
import {
  allocateHeadingSlug,
  headingTag,
  stripAtxClosingHashes,
} from '@shared/lib/markdown-heading';
import { decodeHtmlEntities } from './export-formats/markdown-entity';

// ============================================================================
// Types
// ============================================================================

/** Callback for progress updates during generation */
export type ProgressCallback = (progress: PublishProgress) => void;

/** Options for the static site generator */
export interface StaticSiteGeneratorOptions {
  readonly defaultTitle?: string;
}

/** Processed file result */
interface ProcessedFile {
  readonly path: string;
  readonly title: string;
  readonly htmlContent: string;
  readonly slug: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TITLE = 'MDXPad Site';

function publishedHeading(level: number, text: string, counts: Map<string, number>): string {
  const visible = stripAtxClosingHashes(text);
  return headingTag(level, visible, allocateHeadingSlug(decodeHtmlEntities(visible), counts));
}

function applyPublishedHeadings(escaped: string): string {
  const counts = new Map<string, number>();
  return escaped
    .replace(/^###### (.+)$/gm, (_match, text: string) => publishedHeading(6, text, counts))
    .replace(/^##### (.+)$/gm, (_match, text: string) => publishedHeading(5, text, counts))
    .replace(/^#### (.+)$/gm, (_match, text: string) => publishedHeading(4, text, counts))
    .replace(/^### (.+)$/gm, (_match, text: string) => publishedHeading(3, text, counts))
    .replace(/^## (.+)$/gm, (_match, text: string) => publishedHeading(2, text, counts))
    .replace(/^# (.+)$/gm, (_match, text: string) => publishedHeading(1, text, counts));
}

// ============================================================================
// Static Site Generator
// ============================================================================

/**
 * Generates static HTML sites from MDX files.
 * Supports syntax highlighting, custom styles, and index page generation.
 */
export class StaticSiteGenerator {
  private readonly defaultTitle: string;

  constructor(options: StaticSiteGeneratorOptions = {}) {
    this.defaultTitle = options.defaultTitle ?? DEFAULT_TITLE;
  }

  /**
   * Generate a static site from the provided configuration.
   * @param config - Publish configuration
   * @param onProgress - Optional progress callback
   * @returns Publish result with output details
   */
  async generate(config: PublishConfig, onProgress?: ProgressCallback): Promise<PublishResult> {
    const progress: PublishProgress = {
      totalFiles: config.files.length,
      processedFiles: 0,
      currentFile: null,
      status: 'pending',
      error: null,
    };

    onProgress?.(progress);

    try {
      await mkdir(config.outputDir, { recursive: true });
      progress.status = 'processing';
      onProgress?.(progress);

      const { processedFiles, errors } = await this.processFiles(config, progress, onProgress);

      const indexPath = await this.writeOutputFiles(config, processedFiles);

      progress.status = errors.length > 0 ? 'error' : 'complete';
      progress.currentFile = null;
      progress.error = errors.length > 0 ? errors.join('; ') : null;
      onProgress?.(progress);

      return {
        success: errors.length === 0,
        outputDir: config.outputDir,
        filesGenerated: processedFiles.length,
        indexPath,
        errors,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      progress.status = 'error';
      progress.error = message;
      onProgress?.(progress);

      return {
        success: false,
        outputDir: config.outputDir,
        filesGenerated: 0,
        indexPath: null,
        errors: [message],
      };
    }
  }

  /** Process individual files and return results */
  private async processFiles(
    config: PublishConfig,
    progress: PublishProgress,
    onProgress?: ProgressCallback
  ): Promise<{ processedFiles: ProcessedFile[]; errors: string[] }> {
    const errors: string[] = [];
    const processedFiles: ProcessedFile[] = [];
    const usedSlugs = new Set<string>();

    for (const fileEntry of config.files) {
      progress.currentFile = fileEntry.path;
      onProgress?.(progress);

      try {
        const content = await readFile(fileEntry.path, 'utf-8');
        const title = fileEntry.title ?? this.extractTitle(content, fileEntry.path);
        const slug = this.createSlug(fileEntry.path, usedSlugs);
        const htmlContent = this.convertToHtml(
          content,
          title,
          config.includeStyles,
          config.includeHighlighting
        );
        processedFiles.push({ path: fileEntry.path, title, htmlContent, slug });
        await writeFile(join(config.outputDir, `${slug}.html`), htmlContent, 'utf-8');
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to process ${fileEntry.path}: ${msg}`);
      }

      progress.processedFiles++;
      onProgress?.(progress);
    }

    return { processedFiles, errors };
  }

  /** Write index page and CSS to output directory */
  private async writeOutputFiles(
    config: PublishConfig,
    processedFiles: readonly ProcessedFile[]
  ): Promise<string | null> {
    let indexPath: string | null = null;

    if (config.generateIndex && processedFiles.length > 0) {
      indexPath = join(config.outputDir, 'index.html');
      const siteTitle = config.title ?? this.defaultTitle;
      const indexHtml = this.generateIndexPage(siteTitle, processedFiles, config.includeStyles);
      await writeFile(indexPath, indexHtml, 'utf-8');
    }

    if (config.includeStyles) {
      await writeFile(join(config.outputDir, 'styles.css'), this.getDefaultStyles(), 'utf-8');
    }

    return indexPath;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private extractTitle(content: string, filePath: string): string {
    // Try to extract title from frontmatter
    const frontmatterMatch = /^---\s*\n[\s\S]*?title:\s*(.+)\n[\s\S]*?---/m.exec(content);
    if (frontmatterMatch?.[1]) {
      return frontmatterMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    // Try to extract from first H1
    const h1Match = /^#\s+(.+)$/m.exec(content);
    if (h1Match?.[1]) {
      return h1Match[1].trim();
    }

    // Fall back to filename
    return basename(filePath, extname(filePath));
  }

  private createSlug(filePath: string, usedSlugs: Set<string>): string {
    const name = basename(filePath, extname(filePath));
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'page';
    let slug = base;
    let suffix = 2;
    while (usedSlugs.has(slug)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    usedSlugs.add(slug);
    return slug;
  }

  private convertToHtml(
    mdxContent: string,
    title: string,
    includeStyles: boolean,
    includeHighlighting: boolean
  ): string {
    // Strip frontmatter
    const content = mdxContent.replace(/^---\s*\n[\s\S]*?---\s*\n/, '');

    // Basic MDX to HTML conversion (simplified — full MDX compilation
    // would use @mdx-js/mdx but that requires a renderer runtime)
    const html = this.convertMarkdownToHtml(content);

    const styleLink = includeStyles ? '<link rel="stylesheet" href="styles.css">' : '';

    const highlightStyle = includeHighlighting
      ? '<style>.code-block{background:#1e1e2e;color:#cdd6f4;padding:1rem;border-radius:8px;overflow-x:auto;font-family:monospace;}</style>'
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  ${styleLink}
  ${highlightStyle}
</head>
<body>
  <article class="mdxpad-content">
    <h1>${this.escapeHtml(title)}</h1>
    ${html}
  </article>
</body>
</html>`;
  }

  private htmlLink(label: string, href: string): string {
    const target = href.trim();
    if (!/^(https?:|mailto:|\/|\.\/|\.\.\/)/i.test(target)) {
      return `[${label}](${href})`;
    }
    return `<a href="${target}">${label}</a>`;
  }

  private convertMarkdownToHtml(content: string): string {
    const escaped = this.escapeHtml(decodeHtmlEntities(content));
    const withHeadings = applyPublishedHeadings(escaped);

    const withCode = withHeadings
      .replace(
        /```(\w*)\n([\s\S]*?)```/g,
        (_match, _lang, code: string) => `<pre class="code-block"><code>${code.trim()}</code></pre>`
      )
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    const withInline = withCode
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, (_match, label: string, href: string) =>
        this.htmlLink(label, href)
      );

    const withLists = withInline
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    return withLists.replace(/^(?!<[hupol])([\w].+)$/gm, '<p>$1</p>').replace(/^---$/gm, '<hr>');
  }

  private generateIndexPage(
    title: string,
    files: readonly ProcessedFile[],
    includeStyles: boolean
  ): string {
    const styleLink = includeStyles ? '<link rel="stylesheet" href="styles.css">' : '';

    const links = files
      .map((f) => `    <li><a href="${f.slug}.html">${this.escapeHtml(f.title)}</a></li>`)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  ${styleLink}
</head>
<body>
  <article class="mdxpad-content">
    <h1>${this.escapeHtml(title)}</h1>
    <nav>
      <ul>
${links}
      </ul>
    </nav>
  </article>
</body>
</html>`;
  }

  private getDefaultStyles(): string {
    return `/* MDXPad Generated Site Styles */
:root {
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', monospace;
  --color-text: #1a1a2e;
  --color-bg: #ffffff;
  --color-link: #6366f1;
  --color-border: #e2e8f0;
  --max-width: 768px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.7;
  padding: 2rem;
}

.mdxpad-content {
  max-width: var(--max-width);
  margin: 0 auto;
}

h1, h2, h3, h4, h5 { margin: 1.5em 0 0.5em; line-height: 1.3; }
h1 { font-size: 2rem; }
h2 { font-size: 1.5rem; }
h3 { font-size: 1.25rem; }

p { margin: 1em 0; }
a { color: var(--color-link); text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: var(--font-mono); background: #f1f5f9; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; }
pre code { background: none; padding: 0; }
ul, ol { margin: 1em 0; padding-left: 2em; }
li { margin: 0.25em 0; }
hr { border: none; border-top: 1px solid var(--color-border); margin: 2em 0; }
nav ul { list-style: none; padding: 0; }
nav li { padding: 0.5em 0; border-bottom: 1px solid var(--color-border); }
`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
