import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WorkspaceService, WORKSPACE_MODEL_RELATIVE_PATH } from '../workspace-service';

describe('WorkspaceService', () => {
  let tempDir = '';
  let workspaceRoot = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-workspace-'));
    workspaceRoot = path.join(tempDir, 'workspace');
    await mkdir(workspaceRoot, { recursive: true });
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('creates and persists a workspace model when opening for the first time', async () => {
    const service = new WorkspaceService();
    const result = await service.openWorkspace({ rootPath: workspaceRoot });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.workspace.rootPath).toBe(workspaceRoot);
    expect(result.value.projects).toEqual([]);
    expect(result.value.linkIndex).toEqual({});

    const persistedPath = path.join(workspaceRoot, WORKSPACE_MODEL_RELATIVE_PATH);
    const persisted = JSON.parse(await readFile(persistedPath, 'utf-8')) as typeof result.value;
    expect(persisted.workspace.id).toBe(result.value.workspace.id);
  });

  it('saves and reloads workspace model changes', async () => {
    const service = new WorkspaceService();
    const opened = await service.openWorkspace({ rootPath: workspaceRoot });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const updatedModel = {
      ...opened.value,
      workspace: {
        ...opened.value.workspace,
        name: 'Renamed Workspace',
        updatedAt: new Date().toISOString(),
      },
    };

    const saveResult = await service.saveWorkspace({ model: updatedModel });
    expect(saveResult.ok).toBe(true);

    const reloaded = await new WorkspaceService().openWorkspace({ rootPath: workspaceRoot });
    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) {
      return;
    }

    expect(reloaded.value.workspace.name).toBe('Renamed Workspace');
  });

  it('creates projects and persists them in workspace model', async () => {
    const service = new WorkspaceService();
    const opened = await service.openWorkspace({ rootPath: workspaceRoot });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const documentId = randomUUID();
    const created = await service.createProject({
      workspaceId: opened.value.workspace.id,
      name: 'Project Alpha',
      rootPath: path.join(workspaceRoot, 'projects', 'alpha'),
      documentIds: [documentId],
      activeDocumentId: documentId,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.value.workspaceId).toBe(opened.value.workspace.id);
    expect(created.value.name).toBe('Project Alpha');

    const reloaded = await service.openWorkspace({ rootPath: workspaceRoot });
    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) {
      return;
    }
    expect(reloaded.value.projects).toHaveLength(1);
    expect(reloaded.value.projects[0]?.id).toBe(created.value.id);
  });

  it('tracks links and returns backlinks for a target document', async () => {
    const service = new WorkspaceService();
    const opened = await service.openWorkspace({ rootPath: workspaceRoot });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const sourceDocumentId = randomUUID();
    const targetDocumentId = randomUUID();
    const now = new Date().toISOString();
    const sourcePath = path.join(workspaceRoot, 'notes', 'source.mdx');
    const targetPath = path.join(workspaceRoot, 'notes', 'target.mdx');

    // Register documents in the workspace so addLink target validation passes
    const modelWithDocuments = {
      ...opened.value,
      workspace: {
        ...opened.value.workspace,
        documents: [
          {
            id: sourceDocumentId,
            title: 'Source',
            filePath: sourcePath,
            tags: [],
            createdAt: now,
            updatedAt: now,
          },
          {
            id: targetDocumentId,
            title: 'Target',
            filePath: targetPath,
            tags: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
        updatedAt: now,
      },
    };
    const saveResult = await service.saveWorkspace({ model: modelWithDocuments });
    expect(saveResult.ok).toBe(true);

    const link = {
      sourceDocumentId,
      sourcePath,
      targetDocumentId,
      targetPath,
      targetAnchor: 'intro',
      relation: 'references' as const,
      position: {
        line: 1,
        column: 2,
        offset: 3,
      },
    };

    const added = await service.addLink({
      workspaceId: opened.value.workspace.id,
      link,
    });
    expect(added.ok).toBe(true);

    const backlinks = await service.getBacklinks({
      workspaceId: opened.value.workspace.id,
      documentId: targetDocumentId,
    });

    expect(backlinks.ok).toBe(true);
    if (!backlinks.ok) {
      return;
    }
    expect(backlinks.value).toHaveLength(1);
    expect(backlinks.value[0]).toMatchObject({
      sourceDocumentId,
      targetDocumentId,
      relation: 'references',
    });
  });

  it('queries and aggregates metadata collections from workspace documents', async () => {
    const service = new WorkspaceService();
    const opened = await service.openWorkspace({ rootPath: workspaceRoot });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const docsRoot = path.join(workspaceRoot, 'docs');
    await mkdir(docsRoot, { recursive: true });
    const roadmapPath = path.join(docsRoot, 'roadmap.mdx');
    const draftPath = path.join(docsRoot, 'draft.mdx');
    await writeFile(
      roadmapPath,
      `---
title: Roadmap
status: published
priority: 3
tags: [planning]
---

Roadmap details.`,
      'utf-8'
    );
    await writeFile(
      draftPath,
      `---
title: Draft
status: draft
priority: 9
---

Draft details.`,
      'utf-8'
    );

    const now = new Date().toISOString();
    const roadmapId = randomUUID();
    const draftId = randomUUID();
    const modelWithDocuments = {
      ...opened.value,
      workspace: {
        ...opened.value.workspace,
        documents: [
          {
            id: roadmapId,
            title: 'Roadmap',
            filePath: roadmapPath,
            tags: ['planning'],
            createdAt: now,
            updatedAt: now,
          },
          {
            id: draftId,
            title: 'Draft',
            filePath: draftPath,
            tags: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
        updatedAt: now,
      },
    };
    const saveResult = await service.saveWorkspace({ model: modelWithDocuments });
    expect(saveResult.ok).toBe(true);

    const queryResult = await service.queryMetadataCollection({
      workspaceId: opened.value.workspace.id,
      documentIds: [],
      filters: [
        {
          field: 'status',
          operator: 'eq',
          value: 'published',
        },
      ],
      limit: 10,
    });
    expect(queryResult.ok).toBe(true);
    if (!queryResult.ok) {
      return;
    }
    expect(queryResult.value).toHaveLength(1);
    expect(queryResult.value[0]?.id).toBe(roadmapId);
    expect(queryResult.value[0]?.frontmatter).toMatchObject({ status: 'published', priority: 3 });

    const aggregateResult = await service.aggregateMetadataCollection({
      workspaceId: opened.value.workspace.id,
      documentIds: [],
      filters: [],
      field: 'priority',
      operation: 'histogram',
      histogramBinSize: 5,
    });
    expect(aggregateResult.ok).toBe(true);
    if (!aggregateResult.ok) {
      return;
    }
    expect(aggregateResult.value.total).toBe(2);
    expect(aggregateResult.value.buckets).toEqual(
      expect.objectContaining({
        '0..5': 1,
        '5..10': 1,
      })
    );
  });

  it('returns not found when opening a missing workspace root', async () => {
    const service = new WorkspaceService();
    const missingRootPath = path.join(tempDir, 'missing-workspace');
    const result = await service.openWorkspace({ rootPath: missingRootPath });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('WORKSPACE_NOT_FOUND');
  });
});
