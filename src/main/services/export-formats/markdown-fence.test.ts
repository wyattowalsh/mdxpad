import { describe, expect, it } from 'vitest';

import {
  advanceFence,
  closesFence,
  fenceIndentedCode,
  fenceLanguage,
  openingFence,
} from './markdown-fence';

describe('fences', () => {
  it('opens and closes a tilde fence without treating backticks as the end', () => {
    expect(openingFence('~~~js')).toBe('~~~');
    expect(fenceLanguage('```ts extra')).toBe('ts');
    expect(fenceLanguage('```')).toBe('');
    expect(closesFence('```', '~~~')).toBe(false);
    expect(closesFence('~~~', '~~~')).toBe(true);
    expect(advanceFence('~~~', null)).toBe('~~~');
    expect(advanceFence('# not a heading', '~~~')).toBe('~~~');
    expect(advanceFence('~~~', '~~~')).toBeNull();
  });

  it('wraps indented code and leaves a paragraph alone', () => {
    expect(fenceIndentedCode('Intro\n\n    const x = 1\n')).toBe(
      'Intro\n\n```\nconst x = 1\n```\n'
    );
    expect(fenceIndentedCode('hello\n    still text\n')).toBe('hello\n    still text\n');
    expect(fenceIndentedCode('- item\n\n    continued\n')).toBe('- item\n\n    continued\n');
    expect(fenceIndentedCode('- item\n\n      const x = 1\n')).toBe(
      '- item\n\n      const x = 1\n'
    );
    expect(fenceIndentedCode('Intro\n\n    ```\n    # Secret\n    $x^2$\n')).toBe(
      'Intro\n\n````\n```\n# Secret\n$x^2$\n````\n'
    );
  });
});
