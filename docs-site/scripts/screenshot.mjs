import { chromium } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const BASE = 'http://localhost:3030';
const OUT = join(process.cwd(), 'screenshots');

const pages = [
  { name: '01-home',                   path: '/' },
  { name: '02-docs-home',              path: '/docs' },
  { name: '03-getting-started',        path: '/docs/getting-started' },
  { name: '04-installation',           path: '/docs/getting-started/installation' },
  { name: '05-architecture',           path: '/docs/architecture' },
  { name: '06-constitution',           path: '/docs/architecture/constitution' },
  { name: '07-adr-index',             path: '/docs/architecture/adr' },
  { name: '08-adr-001-ipc',           path: '/docs/architecture/adr/001-ipc-validation' },
  { name: '09-features-ai',           path: '/docs/features/ai-features' },
  { name: '10-features-collab',       path: '/docs/features/collaboration' },
  { name: '11-features-editor',       path: '/docs/features/editor-extensions' },
  { name: '12-features-export',       path: '/docs/features/export-formats' },
  { name: '13-features-plugins',      path: '/docs/features/plugin-system' },
  { name: '14-specifications',        path: '/docs/specifications' },
  { name: '15-development-contrib',   path: '/docs/development/contributing' },
  { name: '16-roadmap',               path: '/docs/roadmap/ideas' },
];

async function run() {
  await mkdir(OUT, { recursive: true });

  const executablePath =
    '/Users/ww/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  const browser = await chromium.launch({ headless: true, executablePath });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  for (const { name, path } of pages) {
    const url = BASE + path;
    console.log(`Capturing ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() =>
      page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    );
    await page.waitForTimeout(500);
    const file = join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`  → ${file}`);
  }

  await browser.close();
  console.log('\nDone — screenshots in', OUT);
}

run().catch(err => { console.error(err); process.exit(1); });
