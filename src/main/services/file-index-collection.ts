import type { NormalizedFrontmatterValue } from '@shared/lib/metadata';

import type { IndexedWorkspaceDocument } from './file-index-service';

const DEFAULT_QUERY_LIMIT = 20;
const MAX_QUERY_LIMIT = 100;

export type FileIndexCollectionFilterOperator =
  | 'eq'
  | 'contains'
  | 'in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

export type FileIndexCollectionFilterValue =
  | string
  | number
  | boolean
  | readonly (string | number | boolean)[];

export interface FileIndexCollectionFilter {
  readonly field: string;
  readonly operator: FileIndexCollectionFilterOperator;
  readonly value: FileIndexCollectionFilterValue;
}

export interface FileIndexCollectionQuery {
  readonly filters?: readonly FileIndexCollectionFilter[];
  readonly limit?: number;
}

export type FileIndexAggregationOperation = 'count' | 'distinct' | 'histogram';

export interface FileIndexAggregationQuery {
  readonly field: string;
  readonly operation: FileIndexAggregationOperation;
  readonly filters?: readonly FileIndexCollectionFilter[];
  readonly histogramBinSize?: number;
}

export interface FileIndexAggregationResult {
  readonly field: string;
  readonly operation: FileIndexAggregationOperation;
  readonly total: number;
  readonly buckets: Readonly<Record<string, number>>;
}

type FilterScalarValue = string | number | boolean;

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

function clampHistogramBinSize(binSize?: number): number {
  if (!binSize || !Number.isFinite(binSize) || binSize <= 0) {
    return 1;
  }
  return binSize;
}

function isFrontmatterRecord(
  value: NormalizedFrontmatterValue
): value is Readonly<Record<string, NormalizedFrontmatterValue>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeFilterScalar(value: string | number | boolean): FilterScalarValue {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function extractScalarValues(value: unknown): FilterScalarValue[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractScalarValues(entry));
  }
  if (typeof value === 'string') {
    return [value.trim().toLowerCase()];
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? [value] : [];
  }
  if (typeof value === 'boolean') {
    return [value];
  }
  return [];
}

function resolveFrontmatterField(
  frontmatter: Readonly<Record<string, NormalizedFrontmatterValue>>,
  fieldPath: string
): unknown {
  const segments = fieldPath.split('.').filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return undefined;
  }

  let current: NormalizedFrontmatterValue | undefined = frontmatter;
  for (const segment of segments) {
    if (!current || !isFrontmatterRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function getDocumentFieldValue(document: IndexedWorkspaceDocument, field: string): unknown {
  if (field.startsWith('frontmatter.')) {
    return resolveFrontmatterField(document.frontmatter, field.slice('frontmatter.'.length));
  }

  switch (field) {
    case 'id':
      return document.id;
    case 'title':
      return document.title;
    case 'filePath':
      return document.filePath;
    case 'slug':
      return document.slug;
    case 'tags':
      return document.tags;
    case 'snippet':
      return document.snippet;
    case 'indexedAt':
      return document.indexedAt;
    default:
      return resolveFrontmatterField(document.frontmatter, field);
  }
}

function toComparableNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsedNumber = Number(trimmed);
  if (Number.isFinite(parsedNumber)) {
    return parsedNumber;
  }

  const parsedDate = Date.parse(trimmed);
  return Number.isNaN(parsedDate) ? null : parsedDate;
}

function compareNumeric(
  candidate: number,
  threshold: number,
  operator: Extract<FileIndexCollectionFilterOperator, 'gt' | 'gte' | 'lt' | 'lte'>
): boolean {
  switch (operator) {
    case 'gt':
      return candidate > threshold;
    case 'gte':
      return candidate >= threshold;
    case 'lt':
      return candidate < threshold;
    case 'lte':
      return candidate <= threshold;
  }
}

function isFilterValueArray(
  value: FileIndexCollectionFilterValue
): value is readonly (string | number | boolean)[] {
  return Array.isArray(value);
}

function documentMatchesFilter(
  document: IndexedWorkspaceDocument,
  filter: FileIndexCollectionFilter
): boolean {
  const fieldValue = getDocumentFieldValue(document, filter.field);
  const scalarValues = extractScalarValues(fieldValue);

  switch (filter.operator) {
    case 'eq': {
      if (isFilterValueArray(filter.value)) {
        const normalizedTargets = new Set(
          filter.value.map((value) => normalizeFilterScalar(value))
        );
        return scalarValues.some((value) => normalizedTargets.has(value));
      }
      const normalizedTarget = normalizeFilterScalar(filter.value);
      return scalarValues.some((value) => value === normalizedTarget);
    }
    case 'contains': {
      const needle = String(filter.value).trim().toLowerCase();
      if (!needle) {
        return false;
      }
      return scalarValues.some((value) => String(value).toLowerCase().includes(needle));
    }
    case 'in': {
      if (!isFilterValueArray(filter.value)) {
        return false;
      }
      const allowedValues = new Set(filter.value.map((value) => normalizeFilterScalar(value)));
      return scalarValues.some((value) => allowedValues.has(value));
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const threshold = toComparableNumber(filter.value);
      if (threshold === null) return false;
      const op = filter.operator;
      return scalarValues.some((value) => {
        const candidate = toComparableNumber(value);
        return candidate !== null && compareNumeric(candidate, threshold, op);
      });
    }
  }
}

function sortDocuments(
  documents: IndexedWorkspaceDocument[],
  limit?: number
): IndexedWorkspaceDocument[] {
  documents.sort(
    (left, right) =>
      right.indexedAt.localeCompare(left.indexedAt) || left.filePath.localeCompare(right.filePath)
  );
  return documents.slice(0, clampLimit(limit));
}

function getFilteredDocuments(
  documents: Iterable<IndexedWorkspaceDocument>,
  filters: readonly FileIndexCollectionFilter[]
): IndexedWorkspaceDocument[] {
  return [...documents].filter((document) =>
    filters.every((filter) => documentMatchesFilter(document, filter))
  );
}

export function queryIndexedDocuments(
  documents: Iterable<IndexedWorkspaceDocument>,
  query: FileIndexCollectionQuery
): IndexedWorkspaceDocument[] {
  const filters = query.filters ?? [];
  const matchedDocuments = getFilteredDocuments(documents, filters);
  return sortDocuments(matchedDocuments, query.limit);
}

export function aggregateIndexedDocuments(
  documents: Iterable<IndexedWorkspaceDocument>,
  query: FileIndexAggregationQuery
): FileIndexAggregationResult {
  const filters = query.filters ?? [];
  const matchedDocuments = getFilteredDocuments(documents, filters);

  if (query.operation === 'count') {
    return {
      field: query.field,
      operation: query.operation,
      total: matchedDocuments.length,
      buckets: { count: matchedDocuments.length },
    };
  }

  const buckets: Record<string, number> = {};
  if (query.operation === 'distinct') {
    for (const document of matchedDocuments) {
      const fieldValues = extractScalarValues(getDocumentFieldValue(document, query.field));
      for (const fieldValue of fieldValues) {
        const key = String(fieldValue);
        buckets[key] = (buckets[key] ?? 0) + 1;
      }
    }
  } else {
    const binSize = clampHistogramBinSize(query.histogramBinSize);
    for (const document of matchedDocuments) {
      const fieldValues = extractScalarValues(getDocumentFieldValue(document, query.field));
      for (const fieldValue of fieldValues) {
        const numericValue = toComparableNumber(fieldValue);
        if (numericValue === null) {
          continue;
        }
        const bucketStart = Math.floor(numericValue / binSize) * binSize;
        const bucketKey = `${bucketStart}..${bucketStart + binSize}`;
        buckets[bucketKey] = (buckets[bucketKey] ?? 0) + 1;
      }
    }
  }

  return {
    field: query.field,
    operation: query.operation,
    total: matchedDocuments.length,
    buckets,
  };
}
