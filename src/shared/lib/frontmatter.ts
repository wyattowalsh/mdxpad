const LEADING_FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

/** Separate a leading YAML block from the document body. */
export function splitLeadingFrontmatter(content: string): {
  frontmatter: string;
  body: string;
} {
  const match = LEADING_FRONTMATTER.exec(content);
  if (match?.index !== 0) {
    return { frontmatter: '', body: content };
  }
  const frontmatter = match[0].endsWith('\n') ? match[0] : `${match[0]}\n`;
  return { frontmatter, body: content.slice(match[0].length) };
}

/** Drop a leading YAML block so export renders the document, not its metadata. */
export function stripLeadingFrontmatter(content: string): string {
  return splitLeadingFrontmatter(content).body;
}
