/**
 * Parse YAML-like frontmatter content.
 * Uses a lightweight best-effort parser shared by outline extraction paths.
 */
export function parseFrontmatterYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('- ') && currentKey && currentArray) {
      currentArray.push(trimmed.slice(2).trim());
      result[currentKey] = currentArray;
      continue;
    }

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      if (currentKey && currentArray) {
        result[currentKey] = currentArray;
      }

      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (value === '' || value === '|' || value === '>') {
        currentKey = key;
        currentArray = [];
      } else {
        currentKey = null;
        currentArray = null;

        if (value === 'true') {
          result[key] = true;
        } else if (value === 'false') {
          result[key] = false;
        } else if (/^-?\d+$/.test(value)) {
          result[key] = parseInt(value, 10);
        } else if (/^-?\d+\.\d+$/.test(value)) {
          result[key] = parseFloat(value);
        } else {
          result[key] = value.replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  return result;
}
