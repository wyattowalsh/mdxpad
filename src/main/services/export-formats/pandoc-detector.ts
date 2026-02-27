import { execFile } from 'node:child_process';

export interface PandocDetectionResult {
  available: boolean;
  version?: string;
  path?: string;
}

let cachedResult: PandocDetectionResult | undefined;

function runWhich(command: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const bin = process.platform === 'win32' ? 'where' : 'which';
    execFile(bin, [command], { timeout: 5_000 }, (error, stdout) => {
      if (error) {
        resolve(undefined);
        return;
      }
      const firstLine = stdout.trim().split('\n')[0]?.trim();
      resolve(firstLine ?? undefined);
    });
  });
}

function getPandocVersion(pandocPath: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(pandocPath, ['--version'], { timeout: 5_000 }, (error, stdout) => {
      if (error) {
        resolve(undefined);
        return;
      }
      const match = /pandoc(?:\.exe)?\s+([\d.]+)/.exec(stdout);
      resolve(match?.[1]);
    });
  });
}

export async function detectPandoc(forceRefresh = false): Promise<PandocDetectionResult> {
  if (cachedResult && !forceRefresh) {
    return cachedResult;
  }

  const pandocPath = await runWhich('pandoc');
  if (!pandocPath) {
    cachedResult = { available: false };
    return cachedResult;
  }

  const version = await getPandocVersion(pandocPath);
  const result: PandocDetectionResult = {
    available: true,
    ...(version !== undefined ? { version } : {}),
    path: pandocPath,
  };
  cachedResult = result;

  return result;
}

export function clearPandocCache(): void {
  cachedResult = undefined;
}
