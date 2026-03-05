import { describe, expect, it } from 'vitest';

import { FilePathSchema } from '../file-schemas';
import {
  SearchIndexRequestSchema,
  SearchQueryRequestSchema,
  SearchStatusRequestSchema,
} from '../search-schemas';

describe('Search workspaceDir schema', () => {
  it.each(['workspace', './workspace', '../workspace'])(
    'rejects non-absolute workspaceDir "%s" consistently with FilePathSchema',
    (workspaceDir) => {
      expect(FilePathSchema.safeParse(workspaceDir).success).toBe(false);
      expect(
        SearchQueryRequestSchema.safeParse({
          query: 'test',
          workspaceDir,
        }).success
      ).toBe(false);
      expect(SearchIndexRequestSchema.safeParse({ workspaceDir }).success).toBe(false);
      expect(SearchStatusRequestSchema.safeParse({ workspaceDir }).success).toBe(false);
    }
  );
});
