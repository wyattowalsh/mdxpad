/**
 * Tests for workspace-schemas Zod validation.
 */

import { describe, expect, it } from 'vitest';

import {
  AggregateMetadataCollectionRequestSchema,
  AggregateMetadataCollectionResponseSchema,
  AddLinkRequestSchema,
  AddLinkResponseSchema,
  CreateProjectRequestSchema,
  CreateProjectResponseSchema,
  GetBacklinksRequestSchema,
  GetBacklinksResponseSchema,
  LinkIndexSchema,
  MetadataCollectionDocumentSchema,
  OpenWorkspaceRequestSchema,
  OpenWorkspaceResponseSchema,
  QueryMetadataCollectionRequestSchema,
  QueryMetadataCollectionResponseSchema,
  SaveWorkspaceRequestSchema,
} from '../workspace-schemas';

const workspaceId = crypto.randomUUID();
const docId = crypto.randomUUID();
const sourceDocId = crypto.randomUUID();

const metadata = {
  id: docId,
  title: 'Doc',
  filePath: '/workspace/docs/doc.mdx',
  tags: ['mdx'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const workspaceModel = {
  version: 1 as const,
  workspace: {
    id: workspaceId,
    name: 'Workspace',
    rootPath: '/workspace',
    documents: [metadata],
    activeDocumentId: docId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  projects: [
    {
      id: crypto.randomUUID(),
      workspaceId,
      name: 'Workspace',
      rootPath: '/workspace',
      documentIds: [docId],
      activeDocumentId: docId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  linkIndex: {},
};

const linkRecord = {
  sourceDocumentId: sourceDocId,
  sourcePath: '/workspace/docs/source.mdx',
  targetDocumentId: docId,
  targetPath: '/workspace/docs/doc.mdx',
  targetAnchor: 'intro',
  relation: 'references' as const,
  position: { line: 1, column: 4, offset: 10 },
};

const metadataCollectionDocument = {
  id: docId,
  filePath: '/workspace/docs/doc.mdx',
  title: 'Doc',
  slug: 'doc',
  tags: ['mdx'],
  snippet: 'Document snippet',
  frontmatter: {
    status: 'published',
    priority: 3,
  },
  indexedAt: new Date().toISOString(),
};

describe('OpenWorkspace schemas', () => {
  it('accepts valid open workspace request', () => {
    expect(OpenWorkspaceRequestSchema.safeParse({ rootPath: '/workspace' }).success).toBe(true);
  });

  it('accepts open workspace success response', () => {
    const result = OpenWorkspaceResponseSchema.safeParse({ ok: true, value: workspaceModel });
    expect(result.success).toBe(true);
  });
});

describe('SaveWorkspace schemas', () => {
  it('accepts valid save workspace request', () => {
    expect(SaveWorkspaceRequestSchema.safeParse({ model: workspaceModel }).success).toBe(true);
  });
});

describe('CreateProject schemas', () => {
  it('defaults optional create project fields', () => {
    const result = CreateProjectRequestSchema.safeParse({
      workspaceId,
      name: 'Project',
      rootPath: '/workspace/project-a',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.documentIds).toEqual([]);
      expect(result.data.activeDocumentId).toBeNull();
    }
  });

  it('accepts create project response payload', () => {
    const result = CreateProjectResponseSchema.safeParse({
      ok: true,
      value: workspaceModel.projects[0],
    });

    expect(result.success).toBe(true);
  });
});

describe('AddLink schemas', () => {
  it('accepts valid add link request', () => {
    const result = AddLinkRequestSchema.safeParse({
      workspaceId,
      link: linkRecord,
    });

    expect(result.success).toBe(true);
  });

  it('rejects add link request with invalid relation', () => {
    const result = AddLinkRequestSchema.safeParse({
      workspaceId,
      link: {
        ...linkRecord,
        relation: 'invalid',
      },
    });

    expect(result.success).toBe(false);
  });

  it('accepts add link error response', () => {
    const result = AddLinkResponseSchema.safeParse({
      ok: false,
      error: {
        code: 'WORKSPACE_INVALID_STATE',
        message: 'Link index is unavailable',
      },
    });

    expect(result.success).toBe(true);
  });
});

describe('GetBacklinks schemas', () => {
  it('accepts valid get backlinks request', () => {
    const result = GetBacklinksRequestSchema.safeParse({
      workspaceId,
      documentId: docId,
    });

    expect(result.success).toBe(true);
  });

  it('accepts get backlinks success response', () => {
    const result = GetBacklinksResponseSchema.safeParse({
      ok: true,
      value: [linkRecord],
    });

    expect(result.success).toBe(true);
  });
});

describe('Metadata collection schemas', () => {
  it('accepts metadata collection document payload', () => {
    const result = MetadataCollectionDocumentSchema.safeParse(metadataCollectionDocument);
    expect(result.success).toBe(true);
  });

  it('defaults optional query metadata request fields', () => {
    const result = QueryMetadataCollectionRequestSchema.safeParse({
      workspaceId,
      filters: [{ field: 'status', operator: 'eq', value: 'published' }],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.documentIds).toEqual([]);
  });

  it('accepts query metadata success response', () => {
    const result = QueryMetadataCollectionResponseSchema.safeParse({
      ok: true,
      value: [metadataCollectionDocument],
    });

    expect(result.success).toBe(true);
  });

  it('accepts aggregate metadata request payload', () => {
    const result = AggregateMetadataCollectionRequestSchema.safeParse({
      workspaceId,
      field: 'priority',
      operation: 'histogram',
      histogramBinSize: 5,
    });

    expect(result.success).toBe(true);
  });

  it('accepts aggregate metadata success response', () => {
    const result = AggregateMetadataCollectionResponseSchema.safeParse({
      ok: true,
      value: {
        field: 'priority',
        operation: 'histogram',
        total: 2,
        buckets: {
          '0..5': 2,
        },
      },
    });

    expect(result.success).toBe(true);
  });
});

describe('LinkIndexSchema', () => {
  it('rejects non-uuid index keys', () => {
    const result = LinkIndexSchema.safeParse({
      invalid: {
        documentId: docId,
        outgoing: [],
        incoming: [],
        updatedAt: new Date().toISOString(),
      },
    });

    expect(result.success).toBe(false);
  });
});
