import katex from 'katex';

import { katexMathTex, renderableMathTex } from '@shared/lib/renderable-math';

import '@shared/lib/katex-mhchem';

function stripEnvironment(source: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source
    .replace(new RegExp(`\\\\begin\\{${escaped}\\}(?:\\[[^\\]]*\\])?(?:\\{[^{}]*\\})?`, 'g'), '')
    .replace(new RegExp(`\\\\end\\{${escaped}\\}`, 'g'), '');
}

/** Prepare TeX for KaTeX, dropping environments KaTeX does not implement. */
export function prepareKatexSource(source: string): string {
  let current = katexMathTex(renderableMathTex(source));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      katex.renderToString(current, { throwOnError: true });
      return current;
    } catch (error) {
      const missing = /No such environment: ([A-Za-z*]+)/.exec(
        error instanceof Error ? error.message : ''
      )?.[1];
      if (missing === undefined) {
        return current;
      }
      const next = stripEnvironment(current, missing);
      if (next === current) {
        return current;
      }
      current = next;
    }
  }
  return current;
}
