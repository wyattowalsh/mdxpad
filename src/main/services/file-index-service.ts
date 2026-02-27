import * as path from 'node:path';

import {
  type FileIndexAggregationQuery,
  type FileIndexAggregationResult,
  type FileIndexCollectionFilter,
  type FileIndexCollectionFilterOperator,
  type FileIndexCollectionFilterValue,
  type FileIndexCollectionQuery,
  aggregateIndexedDocuments,
  queryIndexedDocuments,
} from './file-index-collection';
import { extractDocumentMetadata, type NormalizedFrontmatterValue } from '@shared/lib/metadata';

const DEFAULT_QUERY_LIMIT = 20;
const MAX_QUERY_LIMIT = 100;
const MAX_SNIPPET_LENGTH = 220;

export interface FileIndexDocumentInput {
  readonly id: string;
  readonly filePath: string;
  readonly content: string;
  readonly indexedAt?: string;
}

export interface IndexedWorkspaceDocument {
  readonly id: string;
  readonly filePath: string;
  readonly title: string;
  readonly slug: string;
  readonly tags: readonly string[];
  readonly snippet: string;
  readonly frontmatter: Readonly<Record<string, NormalizedFrontmatterValue>>;
  readonly indexedAt: string;
}

export type FileIndexSearchField =
  | 'title'
  | 'filePath'
  | 'slug'
  | 'tags'
  | 'frontmatter'
  | 'snippet';

export interface FileIndexSearchQuery {
  readonly text: string;
  readonly limit?: number;
}

export interface FileIndexSearchResult {
  readonly document: IndexedWorkspaceDocument;
  readonly score: number;
  readonly matchedFields: readonly FileIndexSearchField[];
}

interface SearchField {
  readonly name: FileIndexSearchField;
  readonly value: string;
  readonly weight: number;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function buildSnippet(body: string): string {
  const compact = body.replace(/\s+/g, ' ').trim();
  if (compact.length <= MAX_SNIPPET_LENGTH) {
    return compact;
  }
  return `${compact.slice(0, MAX_SNIPPET_LENGTH).trimEnd()}…`;
}

function clampLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return DEFAULT_QUERY_LIMIT;
  }

  const normalized = Math.floor(limit);
  if (normalized <= 0) {
    return DEFAULT_QUERY_LIMIT;
  }

  return Math.min(normalized, MAX_QUERY_LIMIT);
}

function flattenFrontmatterValue(value: NormalizedFrontmatterValue): string {
  if (value === null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item): string => flattenFrontmatterValue(item as NormalizedFrontmatterValue))
      .join(' ');
  }

  return Object.entries(value)
    .flatMap(([key, nested]) => [key, flattenFrontmatterValue(nested)])
    .join(' ');
}

function createSearchFields(document: IndexedWorkspaceDocument): SearchField[] {
  return [
    {
      name: 'title',
      value: normalizeText(document.title),
      weight: 8,
    },
    {
      name: 'filePath',
      value: normalizeText(document.filePath),
      weight: 6,
    },
    {
      name: 'slug',
      value: normalizeText(document.slug),
      weight: 5,
    },
    {
      name: 'tags',
      value: normalizeText(document.tags.join(' ')),
      weight: 5,
    },
    {
      name: 'frontmatter',
      value: normalizeText(flattenFrontmatterValue(document.frontmatter)),
      weight: 3,
    },
    {
      name: 'snippet',
      value: normalizeText(document.snippet),
      weight: 2,
    },
  ];
}

export class FileIndexService {
  private readonly documentsById = new Map<string, IndexedWorkspaceDocument>();
  private readonly idByPath = new Map<string, string>();

  public get size(): number {
    return this.documentsById.size;
  }

  public indexDocument(input: FileIndexDocumentInput): IndexedWorkspaceDocument {
    const metadata = extractDocumentMetadata(input.content);
    const fallbackTitle =
      path.basename(input.filePath, path.extname(input.filePath)).trim() || 'Untitled';
    const indexedDocument: IndexedWorkspaceDocument = {
      id: input.id,
      filePath: input.filePath,
      title: metadata.title ?? fallbackTitle,
      slug: metadata.slug,
      tags: metadata.tags,
      snippet: buildSnippet(metadata.body),
      frontmatter: metadata.frontmatter,
      indexedAt: input.indexedAt ?? new Date().toISOString(),
    };

    const previousDocument = this.documentsById.get(input.id);
    if (previousDocument && previousDocument.filePath !== input.filePath) {
      this.idByPath.delete(previousDocument.filePath);
    }

    const pathCollisionId = this.idByPath.get(input.filePath);
    if (pathCollisionId && pathCollisionId !== input.id) {
      this.documentsById.delete(pathCollisionId);
    }

    this.documentsById.set(input.id, indexedDocument);
    this.idByPath.set(input.filePath, input.id);
    return indexedDocument;
  }

  public indexDocuments(inputs: readonly FileIndexDocumentInput[]): IndexedWorkspaceDocument[] {
    return inputs.map((input) => this.indexDocument(input));
  }

  public removeById(documentId: string): boolean {
    const document = this.documentsById.get(documentId);
    if (!document) {
      return false;
    }

    this.documentsById.delete(documentId);
    if (this.idByPath.get(document.filePath) === documentId) {
      this.idByPath.delete(document.filePath);
    }
    return true;
  }

  public removeByPath(filePath: string): boolean {
    const documentId = this.idByPath.get(filePath);
    if (!documentId) {
      return false;
    }

    return this.removeById(documentId);
  }

  public getById(documentId: string): IndexedWorkspaceDocument | null {
    return this.documentsById.get(documentId) ?? null;
  }

  public getByPath(filePath: string): IndexedWorkspaceDocument | null {
    const documentId = this.idByPath.get(filePath);
    if (!documentId) {
      return null;
    }
    return this.documentsById.get(documentId) ?? null;
  }

  public query(query: FileIndexSearchQuery): FileIndexSearchResult[] {
    const tokens = normalizeText(query.text)
      .split(/\s+/)
      .filter((token) => token.length > 0);
    if (tokens.length === 0) {
      return [];
    }

    const results: FileIndexSearchResult[] = [];
    for (const document of this.documentsById.values()) {
      const fields = createSearchFields(document);
      const matchedFields = new Set<FileIndexSearchField>();
      let score = 0;
      let allTokensMatched = true;

      for (const token of tokens) {
        let tokenMatched = false;
        for (const field of fields) {
          if (!field.value.includes(token)) {
            continue;
          }
          tokenMatched = true;
          matchedFields.add(field.name);
          score += field.weight;
        }
        if (!tokenMatched) {
          allTokensMatched = false;
          break;
        }
      }

      if (!allTokensMatched) {
        continue;
      }

      results.push({
        document,
        score,
        matchedFields: [...matchedFields],
      });
    }

    results.sort(
      (left, right) =>
        right.score - left.score ||
        right.document.indexedAt.localeCompare(left.document.indexedAt) ||
        left.document.filePath.localeCompare(right.document.filePath)
    );

    return results.slice(0, clampLimit(query.limit));
  }

  public queryCollection(query: FileIndexCollectionQuery): IndexedWorkspaceDocument[] {
    return queryIndexedDocuments(this.documentsById.values(), query);
  }

  public aggregateCollection(query: FileIndexAggregationQuery): FileIndexAggregationResult {
    return aggregateIndexedDocuments(this.documentsById.values(), query);
  }

  public clear(): void {
    this.documentsById.clear();
    this.idByPath.clear();
  }
}

export type {
  FileIndexCollectionFilter,
  FileIndexCollectionFilterOperator,
  FileIndexCollectionFilterValue,
  FileIndexCollectionQuery,
  FileIndexAggregationQuery,
  FileIndexAggregationResult,
};
