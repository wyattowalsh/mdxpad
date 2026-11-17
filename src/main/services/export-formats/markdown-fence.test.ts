import { describe, expect, it } from 'vitest';

import { advanceFence, closesFence, openingFence } from './markdown-fence';

describe('fences', () => {
  it('opens and closes a tilde fence without treating backticks as the end', () => {
    expect(openingFence('~~~js')).toBe('~~~');
    expect(closesFence('```', '~~~')).toBe(false);
    expect(closesFence('~~~', '~~~')).toBe(true);
    expect(advanceFence('~~~', null)).toBe('~~~');
    expect(advanceFence('# not a heading', '~~~')).toBe('~~~');
    expect(advanceFence('~~~', '~~~')).toBeNull();
  });
});
