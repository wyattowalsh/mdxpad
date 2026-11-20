/**
 * Notion importer.
 * Fetches Notion page blocks via API and converts to MDX.
 * Uses direct HTTP calls to avoid heavyweight @notionhq/client dependency.
 *
 * @module notion-importer
 */

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

interface NotionBlock {
  id?: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}

interface NotionRichText {
  plain_text: string;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
  href?: string | null;
}

function extractRichText(richTexts: NotionRichText[]): string {
  return richTexts
    .map((rt) => {
      let text = rt.plain_text;
      if (rt.annotations?.code) text = `\`${text}\``;
      if (rt.annotations?.bold) text = `**${text}**`;
      if (rt.annotations?.italic) text = `_${text}_`;
      if (rt.annotations?.strikethrough) text = `~~${text}~~`;
      if (rt.href) text = `[${text}](${rt.href})`;
      return text;
    })
    .join('');
}

function stringField(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

function mediaUrl(data: Record<string, unknown>): string {
  const file = data.file as { url?: unknown } | undefined;
  const external = data.external as { url?: unknown } | undefined;
  if (typeof file?.url === 'string' && file.url.length > 0) {
    return file.url;
  }
  if (typeof external?.url === 'string' && external.url.length > 0) {
    return external.url;
  }
  return stringField(data, 'url');
}

function linkedLine(label: string, url: string): string | null {
  if (url.length === 0 && label.length === 0) {
    return null;
  }
  if (url.length === 0) {
    return `${label}\n`;
  }
  if (label.length === 0) {
    return `${url}\n`;
  }
  return `[${label}](${url})\n`;
}

function extraBlock(type: string, data: Record<string, unknown>, text: string): string | null {
  switch (type) {
    case 'equation': {
      const expression = stringField(data, 'expression');
      return expression.length > 0 ? `$$\n${expression}\n$$\n` : null;
    }
    case 'bookmark':
    case 'embed':
    case 'link_preview':
      return linkedLine(text, stringField(data, 'url') || mediaUrl(data));
    case 'video':
    case 'audio':
    case 'file':
    case 'pdf':
      return linkedLine(text, mediaUrl(data));
    case 'child_page':
    case 'child_database': {
      const title = stringField(data, 'title') || text;
      return title.length > 0 ? `## ${title}\n` : null;
    }
    case 'table_row':
      return tableRow(data);
    default:
      return text.length > 0 ? `${text}\n` : null;
  }
}

function tableRow(data: Record<string, unknown>): string | null {
  const cells = data.cells as NotionRichText[][] | undefined;
  if (!cells || cells.length === 0) {
    return null;
  }
  const row = cells.map((cell) => extractRichText(cell).replaceAll('|', '\\|')).join(' | ');
  return `| ${row} |\n`;
}

function tableMarkdown(nested: string): string | null {
  const rows = nested
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'));
  if (rows.length === 0) {
    return nested.trim().length > 0 ? `${nested.trim()}\n` : null;
  }
  const width = Math.max(rows[0]?.split('|').length ?? 2, 2) - 2;
  const rule = `| ${Array.from({ length: width }, () => '---').join(' | ')} |`;
  return `${[rows[0], rule, ...rows.slice(1)].join('\n')}\n`;
}

function combineBlock(type: string, own: string | null, nested: string): string | null {
  if (type === 'table') {
    return tableMarkdown(nested);
  }
  if (type === 'toggle' && own !== null) {
    if (nested.trim().length === 0) {
      return own;
    }
    return own.replace('</details>', `${nested.trim()}\n</details>`);
  }
  if (own === null) {
    return nested.trim().length > 0 ? `${nested.trim()}\n` : null;
  }
  if (nested.trim().length === 0) {
    return own;
  }
  return `${own}\n${nested.trim()}\n`;
}

function richCaption(data: Record<string, unknown>): string {
  const caption = data.caption;
  if (!Array.isArray(caption)) {
    return '';
  }
  return extractRichText(caption as NotionRichText[]).trim();
}

function codeBlock(data: Record<string, unknown>, text: string): string {
  const language = stringField(data, 'language');
  const caption = richCaption(data);
  const fence = `\`\`\`${language}\n${text}\n\`\`\`\n`;
  if (caption.length === 0 || caption === text.trim()) {
    return fence;
  }
  return `${fence}${caption}\n`;
}

function calloutEmoji(data: Record<string, unknown>): string {
  const icon = data.icon;
  if (icon === null || typeof icon !== 'object') {
    return '';
  }
  const emoji = (icon as { emoji?: unknown }).emoji;
  return typeof emoji === 'string' ? emoji.trim() : '';
}

function getBlockContent(block: NotionBlock): string | null {
  const data = block[block.type] as Record<string, unknown> | undefined;
  if (!data) return null;

  const richText = (data.rich_text ?? data.caption) as NotionRichText[] | undefined;
  const text = richText ? extractRichText(richText) : '';

  switch (block.type) {
    case 'paragraph':
      return text + '\n';
    case 'heading_1':
      return `# ${text}\n`;
    case 'heading_2':
      return `## ${text}\n`;
    case 'heading_3':
      return `### ${text}\n`;
    case 'bulleted_list_item':
      return `- ${text}\n`;
    case 'numbered_list_item':
      return `1. ${text}\n`;
    case 'to_do': {
      const checked = data.checked as boolean;
      return `- [${checked ? 'x' : ' '}] ${text}\n`;
    }
    case 'code':
      return codeBlock(data, text);
    case 'quote':
      return `> ${text}\n`;
    case 'callout': {
      const emoji = calloutEmoji(data);
      const body = emoji.length > 0 ? `${emoji} ${text}`.trim() : text;
      return `> ${body}\n`;
    }
    case 'divider':
      return '---\n';
    case 'image':
      return `![${text}](${mediaUrl(data)})\n`;
    case 'toggle':
      return `<details>\n<summary>${text}</summary>\n</details>\n`;
    default:
      return extraBlock(block.type, data, text);
  }
}

function notionHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Notion-Version': NOTION_API_VERSION,
    'Content-Type': 'application/json',
  };
}

function notionFailure(status: number, body: string): NotionImportError {
  if (status === 401) {
    return new NotionImportError('Unauthorized: invalid Notion API key', 'UNAUTHORIZED');
  }
  if (status === 404) {
    return new NotionImportError('Page not found', 'NOT_FOUND');
  }
  return new NotionImportError(`Notion API error (${status}): ${body}`, 'API_ERROR');
}

async function fetchBlockPage(
  blockId: string,
  apiKey: string,
  cursor?: string
): Promise<{ results: NotionBlock[]; next?: string }> {
  const url = new URL(`${NOTION_API_BASE}/blocks/${blockId}/children`);
  url.searchParams.set('page_size', '100');
  if (cursor) {
    url.searchParams.set('start_cursor', cursor);
  }
  const response = await fetch(url, { headers: notionHeaders(apiKey) });
  if (!response.ok) {
    throw notionFailure(response.status, await response.text());
  }
  const json = (await response.json()) as {
    results?: NotionBlock[];
    has_more?: boolean;
    next_cursor?: string | null;
  };
  const next = json.has_more && json.next_cursor ? json.next_cursor : undefined;
  return { results: json.results ?? [], ...(next ? { next } : {}) };
}

async function fetchNotionBlocks(blockId: string, apiKey: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchBlockPage(blockId, apiKey, cursor);
    blocks.push(...page.results);
    cursor = page.next;
  } while (cursor);
  return blocks;
}

async function blocksToMarkdown(
  blocks: readonly NotionBlock[],
  apiKey: string,
  seen: Set<string>,
  warnings: string[]
): Promise<string> {
  const lines: string[] = [];
  for (const block of blocks) {
    const id = typeof block.id === 'string' ? block.id : '';
    if (id.length > 0 && seen.has(id)) {
      continue;
    }
    if (id.length > 0) {
      seen.add(id);
    }
    const own = getBlockContent(block);
    const children =
      block.has_children === true && id.length > 0 ? await fetchNotionBlocks(id, apiKey) : [];
    const nested =
      children.length > 0 ? await blocksToMarkdown(children, apiKey, seen, warnings) : '';
    const combined = combineBlock(block.type, own, nested);
    if (combined === null) {
      warnings.push(`Unsupported block type: ${block.type}`);
      continue;
    }
    lines.push(combined);
  }
  return lines.join('\n');
}

async function fetchPageTitle(pageId: string, apiKey: string): Promise<string | undefined> {
  try {
    const url = `${NOTION_API_BASE}/pages/${pageId}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Notion-Version': NOTION_API_VERSION,
      },
    });
    if (!response.ok) return undefined;
    const json = (await response.json()) as Record<string, unknown>;
    const properties = json.properties as Record<string, unknown> | undefined;
    if (!properties) return undefined;
    const titleProp = properties.title ?? properties.Name;
    if (!titleProp) return undefined;
    const titleData = titleProp as { title?: NotionRichText[] };
    return titleData.title ? extractRichText(titleData.title) : undefined;
  } catch {
    return undefined;
  }
}

export class NotionImportError extends Error {
  readonly code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'API_ERROR';
  constructor(message: string, code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'API_ERROR') {
    super(message);
    this.name = 'NotionImportError';
    this.code = code;
  }
}

export async function importFromNotion(
  pageId: string,
  apiKey: string
): Promise<{ content: string; title?: string; warnings: string[] }> {
  const cleanId = pageId.replace(/-/g, '');
  const warnings: string[] = [];

  const [blocks, title] = await Promise.all([
    fetchNotionBlocks(cleanId, apiKey),
    fetchPageTitle(cleanId, apiKey),
  ]);

  const body = await blocksToMarkdown(blocks, apiKey, new Set<string>(), warnings);
  const content = title ? `# ${title}\n\n${body}` : body;

  const result: { content: string; title?: string; warnings: string[] } = {
    content: content.trim(),
    warnings,
  };
  if (title !== undefined) {
    result.title = title;
  }
  return result;
}
