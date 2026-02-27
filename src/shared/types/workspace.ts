/**
 * Workspace model types for multi-project navigation and link indexing.
 */

import type { DocumentMetadata, Workspace as RootWorkspace } from './root';

export type Workspace = RootWorkspace;
export type WorkspaceId = Workspace['id'];
export type WorkspaceDocument = DocumentMetadata;
export type WorkspaceDocumentId = WorkspaceDocument['id'];

export interface Project {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly name: Workspace['name'];
  readonly rootPath: Workspace['rootPath'];
  readonly documentIds: readonly WorkspaceDocumentId[];
  readonly activeDocumentId: Workspace['activeDocumentId'];
  readonly createdAt: Workspace['createdAt'];
  readonly updatedAt: Workspace['updatedAt'];
}

export type LinkRelation = 'references' | 'derived-from';

export interface LinkPosition {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

export interface LinkRecord {
  readonly sourceDocumentId: WorkspaceDocumentId;
  readonly sourcePath: WorkspaceDocument['filePath'];
  readonly targetDocumentId: WorkspaceDocumentId | null;
  readonly targetPath: WorkspaceDocument['filePath'];
  readonly targetAnchor: string | null;
  readonly relation: LinkRelation;
  readonly position: LinkPosition | null;
}

export interface LinkIndexEntry {
  readonly documentId: WorkspaceDocumentId;
  readonly outgoing: readonly LinkRecord[];
  readonly incoming: readonly LinkRecord[];
  readonly updatedAt: Workspace['updatedAt'];
}

export type LinkIndex = Record<WorkspaceDocumentId, LinkIndexEntry>;

export interface WorkspaceModel {
  readonly version: 1;
  readonly workspace: Workspace;
  readonly projects: readonly Project[];
  readonly linkIndex: LinkIndex;
}
