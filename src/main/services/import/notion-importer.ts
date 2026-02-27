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
  type: string;
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

function getBlockContent(block: NotionBlock): string | null {
  const data = block[block.type] as Record<string, unknown> | undefined;
  if (!data) return null;

  const richText = data.rich_text as NotionRichText[] | undefined;
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
    case 'code': {
      const language = (data.language as string) || '';
      return `\`\`\`${language}\n${text}\n\`\`\`\n`;
    }
    case 'quote':
      return `> ${text}\n`;
    case 'callout':
      return `> ${text}\n`;
    case 'divider':
      return '---\n';
    case 'image': {
      const imageData = data;
      const url =
        (imageData.file as Record<string, string> | undefined)?.url ??
        (imageData.external as Record<string, string> | undefined)?.url ??
        '';
      const caption = richText ? extractRichText(richText) : '';
      return `![${caption}](${url})\n`;
    }
    case 'toggle':
      return `<details>\n<summary>${text}</summary>\n</details>\n`;
    default:
      return text ? text + '\n' : null;
  }
}

async function fetchNotionBlocks(pageId: string, apiKey: string): Promise<NotionBlock[]> {
  const url = `${NOTION_API_BASE}/blocks/${pageId}/children?page_size=100`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw new NotionImportError('Unauthorized: invalid Notion API key', 'UNAUTHORIZED');
    }
    if (response.status === 404) {
      throw new NotionImportError('Page not found', 'NOT_FOUND');
    }
    throw new NotionImportError(`Notion API error (${response.status}): ${body}`, 'API_ERROR');
  }

  const json = (await response.json()) as { results: NotionBlock[] };
  return json.results;
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

  const lines: string[] = [];
  if (title) {
    lines.push(`# ${title}\n`);
  }

  for (const block of blocks) {
    const content = getBlockContent(block);
    if (content !== null) {
      lines.push(content);
    } else {
      warnings.push(`Unsupported block type: ${block.type}`);
    }
  }

  const result: { content: string; title?: string; warnings: string[] } = {
    content: lines.join('\n').trim(),
    warnings,
  };
  if (title !== undefined) {
    result.title = title;
  }
  return result;
}
