/**
 * Workspace IPC contract schemas.
 * Zod schemas for workspace/project lifecycle and link graph operations.
 */

import { z } from 'zod';

import { IPC_CHANNELS } from '../lib/ipc';
import { DocumentMetadataSchema, WorkspaceSchema } from '../types/root';
import type {
  LinkIndex,
  LinkIndexEntry,
  LinkPosition,
  LinkRecord,
  Project,
  WorkspaceDocumentId,
  WorkspaceId,
  WorkspaceModel,
} from '../types/workspace';

// ============================================================================
// Workspace IPC Channel Constants (single source of truth)
// ============================================================================

export const WorkspaceChannels = {
  OPEN: IPC_CHANNELS.workspace.open,
  SAVE: IPC_CHANNELS.workspace.save,
  CREATE_PROJECT: IPC_CHANNELS.workspace.createProject,
  ADD_LINK: IPC_CHANNELS.workspace.addLink,
  GET_BACKLINKS: IPC_CHANNELS.workspace.getBacklinks,
  QUERY_METADATA_COLLECTION: IPC_CHANNELS.workspace.queryMetadataCollection,
  AGGREGATE_METADATA_COLLECTION: IPC_CHANNELS.workspace.aggregateMetadataCollection,
} as const;

// ============================================================================
// Base Workspace Schemas
// ============================================================================

export const WorkspaceIdSchema: z.ZodType<WorkspaceId> = WorkspaceSchema.shape.id;
export const WorkspaceDocumentIdSchema: z.ZodType<WorkspaceDocumentId> =
  DocumentMetadataSchema.shape.id;

export const ProjectSchema: z.ZodType<Project> = z.object({
  id: z.string().uuid(),
  workspaceId: WorkspaceIdSchema,
  name: WorkspaceSchema.shape.name,
  rootPath: WorkspaceSchema.shape.rootPath,
  documentIds: z.array(WorkspaceDocumentIdSchema),
  activeDocumentId: WorkspaceSchema.shape.activeDocumentId,
  createdAt: WorkspaceSchema.shape.createdAt,
  updatedAt: WorkspaceSchema.shape.updatedAt,
});

export const LinkPositionSchema: z.ZodType<LinkPosition> = z.object({
  line: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
});

export const LinkRelationSchema = z.enum(['references', 'derived-from']);

export const LinkRecordSchema: z.ZodType<LinkRecord> = z.object({
  sourceDocumentId: WorkspaceDocumentIdSchema,
  sourcePath: DocumentMetadataSchema.shape.filePath,
  targetDocumentId: WorkspaceDocumentIdSchema.nullable(),
  targetPath: DocumentMetadataSchema.shape.filePath,
  targetAnchor: z.string().nullable(),
  relation: LinkRelationSchema,
  position: LinkPositionSchema.nullable(),
});

export const LinkIndexEntrySchema: z.ZodType<LinkIndexEntry> = z.object({
  documentId: WorkspaceDocumentIdSchema,
  outgoing: z.array(LinkRecordSchema),
  incoming: z.array(LinkRecordSchema),
  updatedAt: WorkspaceSchema.shape.updatedAt,
});

export const LinkIndexSchema: z.ZodType<LinkIndex> = z.record(
  WorkspaceDocumentIdSchema,
  LinkIndexEntrySchema
);

export const WorkspaceModelSchema: z.ZodType<WorkspaceModel> = z.object({
  /**
   * Schema version for workspace model format.
   * @migration When bumping to v2, add a transformFn in the parser to handle v1->v2 migration.
   */
  version: z.literal(1),
  workspace: WorkspaceSchema,
  projects: z.array(ProjectSchema),
  linkIndex: LinkIndexSchema,
});

// ============================================================================
// Workspace Result Schemas
// ============================================================================

export const WorkspaceErrorSchema = z.discriminatedUnion('code', [
  z.object({
    code: z.literal('WORKSPACE_NOT_FOUND'),
    message: z.string().min(1),
  }),
  z.object({
    code: z.literal('WORKSPACE_ACCESS_DENIED'),
    message: z.string().min(1),
  }),
  z.object({
    code: z.literal('WORKSPACE_INVALID_STATE'),
    message: z.string().min(1),
  }),
  z.object({
    code: z.literal('UNKNOWN'),
    message: z.string().min(1),
  }),
]);

export type WorkspaceError = z.infer<typeof WorkspaceErrorSchema>;

export function createWorkspaceResultSchema<T extends z.ZodType>(valueSchema: T) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value: valueSchema }),
    z.object({ ok: z.literal(false), error: WorkspaceErrorSchema }),
  ]);
}

export const WorkspaceResultVoidSchema = createWorkspaceResultSchema(z.void());
export type WorkspaceResultVoid = z.infer<typeof WorkspaceResultVoidSchema>;

// ============================================================================
// IPC Channel Schemas - Workspace Operations
// ============================================================================

export const OpenWorkspaceRequestSchema = z.object({
  rootPath: WorkspaceSchema.shape.rootPath,
});
export type OpenWorkspaceRequest = z.infer<typeof OpenWorkspaceRequestSchema>;

export const OpenWorkspaceResponseSchema = createWorkspaceResultSchema(WorkspaceModelSchema);
export type OpenWorkspaceResponse = z.infer<typeof OpenWorkspaceResponseSchema>;

export const SaveWorkspaceRequestSchema = z.object({
  model: WorkspaceModelSchema,
});
export type SaveWorkspaceRequest = z.infer<typeof SaveWorkspaceRequestSchema>;

export const SaveWorkspaceResponseSchema = WorkspaceResultVoidSchema;
export type SaveWorkspaceResponse = z.infer<typeof SaveWorkspaceResponseSchema>;

export const CreateProjectRequestSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  name: WorkspaceSchema.shape.name,
  rootPath: WorkspaceSchema.shape.rootPath,
  documentIds: z.array(WorkspaceDocumentIdSchema).optional().default([]),
  activeDocumentId: WorkspaceSchema.shape.activeDocumentId.optional().default(null),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const CreateProjectResponseSchema = createWorkspaceResultSchema(ProjectSchema);
export type CreateProjectResponse = z.infer<typeof CreateProjectResponseSchema>;

export const AddLinkRequestSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  link: LinkRecordSchema,
});
export type AddLinkRequest = z.infer<typeof AddLinkRequestSchema>;

export const AddLinkResponseSchema = createWorkspaceResultSchema(LinkRecordSchema);
export type AddLinkResponse = z.infer<typeof AddLinkResponseSchema>;

export const GetBacklinksRequestSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  documentId: WorkspaceDocumentIdSchema,
});
export type GetBacklinksRequest = z.infer<typeof GetBacklinksRequestSchema>;

export const GetBacklinksResponseSchema = createWorkspaceResultSchema(z.array(LinkRecordSchema));
export type GetBacklinksResponse = z.infer<typeof GetBacklinksResponseSchema>;

const MetadataFrontmatterValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(MetadataFrontmatterValueSchema),
    z.record(z.string(), MetadataFrontmatterValueSchema),
  ])
);

export const MetadataCollectionDocumentSchema = z.object({
  id: WorkspaceDocumentIdSchema,
  filePath: DocumentMetadataSchema.shape.filePath,
  title: z.string().min(1),
  slug: z.string().min(1),
  tags: z.array(z.string()),
  snippet: z.string(),
  frontmatter: z.record(z.string(), MetadataFrontmatterValueSchema),
  indexedAt: WorkspaceSchema.shape.updatedAt,
});
export type MetadataCollectionDocument = z.infer<typeof MetadataCollectionDocumentSchema>;

export const MetadataCollectionFilterOperatorSchema = z.enum([
  'eq',
  'contains',
  'in',
  'gt',
  'gte',
  'lt',
  'lte',
]);
export type MetadataCollectionFilterOperator = z.infer<
  typeof MetadataCollectionFilterOperatorSchema
>;

const MetadataCollectionFilterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

export const MetadataCollectionFilterSchema = z.object({
  field: z.string().min(1),
  operator: MetadataCollectionFilterOperatorSchema,
  value: MetadataCollectionFilterValueSchema,
});
export type MetadataCollectionFilter = z.infer<typeof MetadataCollectionFilterSchema>;

export const QueryMetadataCollectionRequestSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  documentIds: z.array(WorkspaceDocumentIdSchema).optional().default([]),
  filters: z.array(MetadataCollectionFilterSchema).optional().default([]),
  limit: z.number().int().positive().max(100).optional(),
});
export type QueryMetadataCollectionRequest = z.infer<typeof QueryMetadataCollectionRequestSchema>;

export const QueryMetadataCollectionResponseSchema = createWorkspaceResultSchema(
  z.array(MetadataCollectionDocumentSchema)
);
export type QueryMetadataCollectionResponse = z.infer<typeof QueryMetadataCollectionResponseSchema>;

export const MetadataCollectionAggregationOperationSchema = z.enum([
  'count',
  'distinct',
  'histogram',
]);
export type MetadataCollectionAggregationOperation = z.infer<
  typeof MetadataCollectionAggregationOperationSchema
>;

export const AggregateMetadataCollectionRequestSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  documentIds: z.array(WorkspaceDocumentIdSchema).optional().default([]),
  filters: z.array(MetadataCollectionFilterSchema).optional().default([]),
  field: z.string().min(1),
  operation: MetadataCollectionAggregationOperationSchema,
  histogramBinSize: z.number().positive().optional(),
});
export type AggregateMetadataCollectionRequest = z.infer<
  typeof AggregateMetadataCollectionRequestSchema
>;

export const MetadataCollectionAggregateSchema = z.object({
  field: z.string().min(1),
  operation: MetadataCollectionAggregationOperationSchema,
  total: z.number().int().nonnegative(),
  buckets: z.record(z.string(), z.number().int().nonnegative()),
});
export type MetadataCollectionAggregate = z.infer<typeof MetadataCollectionAggregateSchema>;

export const AggregateMetadataCollectionResponseSchema = createWorkspaceResultSchema(
  MetadataCollectionAggregateSchema
);
export type AggregateMetadataCollectionResponse = z.infer<
  typeof AggregateMetadataCollectionResponseSchema
>;
