/**
 * Preview media elements that drop a local or script URL.
 */

import type { JSX } from 'react';
import type {
  AudioHTMLAttributes,
  EmbedHTMLAttributes,
  IframeHTMLAttributes,
  ObjectHTMLAttributes,
  SourceHTMLAttributes,
  TrackHTMLAttributes,
  VideoHTMLAttributes,
} from 'react';

import { isBlockedPreviewHref, safePreviewSrcSet } from '../preview-href';

function safeMediaUrl(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && !isBlockedPreviewHref(value)
    ? value
    : undefined;
}

export function Video({
  src,
  poster,
  className = '',
  ...props
}: VideoHTMLAttributes<HTMLVideoElement>): JSX.Element {
  const safeSrc = safeMediaUrl(src);
  const safePoster = safeMediaUrl(poster);
  return (
    <video
      {...props}
      {...(safeSrc ? { src: safeSrc } : {})}
      {...(safePoster ? { poster: safePoster } : {})}
      className={`mdx-video ${className}`.trim()}
    />
  );
}

export function Audio({
  src,
  className = '',
  ...props
}: AudioHTMLAttributes<HTMLAudioElement>): JSX.Element {
  const safeSrc = safeMediaUrl(src);
  return (
    <audio
      {...props}
      {...(safeSrc ? { src: safeSrc } : {})}
      className={`mdx-audio ${className}`.trim()}
    />
  );
}

export function Source({
  src,
  srcSet,
  ...props
}: SourceHTMLAttributes<HTMLSourceElement>): JSX.Element {
  const safeSrc = safeMediaUrl(src);
  const safeSrcSet = typeof srcSet === 'string' ? safePreviewSrcSet(srcSet) : undefined;
  return (
    <source
      {...props}
      {...(safeSrc ? { src: safeSrc } : {})}
      {...(safeSrcSet ? { srcSet: safeSrcSet } : {})}
    />
  );
}

export function Track({ src, ...props }: TrackHTMLAttributes<HTMLTrackElement>): JSX.Element {
  const safeSrc = safeMediaUrl(src);
  return <track {...props} {...(safeSrc ? { src: safeSrc } : {})} />;
}

export function Iframe({
  src,
  srcDoc: _srcDoc,
  className = '',
  ...props
}: IframeHTMLAttributes<HTMLIFrameElement>): JSX.Element {
  const safeSrc = safeMediaUrl(src);
  return (
    <iframe
      {...props}
      {...(safeSrc ? { src: safeSrc } : {})}
      className={`mdx-iframe ${className}`.trim()}
    />
  );
}

export function ObjectFrame({
  data,
  className = '',
  ...props
}: ObjectHTMLAttributes<HTMLObjectElement>): JSX.Element {
  const safeData = safeMediaUrl(data);
  return (
    <object
      {...props}
      {...(safeData ? { data: safeData } : {})}
      className={`mdx-object ${className}`.trim()}
    />
  );
}

export function Embed({
  src,
  className = '',
  ...props
}: EmbedHTMLAttributes<HTMLEmbedElement>): JSX.Element {
  const safeSrc = safeMediaUrl(src);
  return (
    <embed
      {...props}
      {...(safeSrc ? { src: safeSrc } : {})}
      className={`mdx-embed ${className}`.trim()}
    />
  );
}

export const previewMediaComponents = {
  video: Video,
  audio: Audio,
  source: Source,
  track: Track,
  iframe: Iframe,
  object: ObjectFrame,
  embed: Embed,
};
