/**
 * Decides when a video or audio element has nothing the preview can play,
 * so its fallback words can be shown instead of an empty player.
 */

import { isBlockedPreviewResource, safePreviewSrcSet } from './preview-href';

function playableAddress(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && !isBlockedPreviewResource(value);
}

function listed(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => listed(item));
  }
  if (value === null || value === undefined || typeof value === 'boolean') {
    return [];
  }
  return [value];
}

function nodeParts(
  node: unknown
): { readonly type: unknown; readonly props: Record<string, unknown> } | null {
  if (node === null || typeof node !== 'object' || !('type' in node) || !('props' in node)) {
    return null;
  }
  const props = (node as { readonly props?: unknown }).props;
  if (props === null || typeof props !== 'object') {
    return null;
  }
  return {
    type: (node as { readonly type: unknown }).type,
    props: props as Record<string, unknown>,
  };
}

function matches(type: unknown, name: string, component: unknown): boolean {
  return type === component || (typeof type === 'string' && type.toLowerCase() === name);
}

function playableSource(node: unknown, sourceType: unknown): boolean {
  const element = nodeParts(node);
  if (element === null || !matches(element.type, 'source', sourceType)) {
    return false;
  }
  if (playableAddress(element.props.src)) {
    return true;
  }
  return (
    typeof element.props.srcSet === 'string' &&
    safePreviewSrcSet(element.props.srcSet) !== undefined
  );
}

function hiddenChild(node: unknown, sourceType: unknown, trackType: unknown): boolean {
  const element = nodeParts(node);
  if (element === null) {
    return false;
  }
  return matches(element.type, 'source', sourceType) || matches(element.type, 'track', trackType);
}

function visibleFallback(node: unknown, sourceType: unknown, trackType: unknown): boolean {
  if (typeof node === 'string') {
    return node.trim().length > 0;
  }
  if (typeof node === 'number') {
    return true;
  }
  return !hiddenChild(node, sourceType, trackType);
}

/** Words to show when an embed cannot load. Undefined keeps the embed element. */
export function embedReplacement(src: unknown, children: unknown, alt: unknown): unknown {
  if (playableAddress(src)) {
    return undefined;
  }
  if (showMediaFallback(src, children)) {
    return children;
  }
  if (typeof alt === 'string' && alt.trim().length > 0) {
    return alt;
  }
  return undefined;
}

/** True when the player cannot load a clip and the words inside it should be shown. */
export function showMediaFallback(
  src: unknown,
  children: unknown,
  sourceType: unknown = 'source',
  trackType: unknown = 'track'
): boolean {
  const nodes = listed(children);
  if (playableAddress(src) || nodes.some((node) => playableSource(node, sourceType))) {
    return false;
  }
  return nodes.some((node) => visibleFallback(node, sourceType, trackType));
}
