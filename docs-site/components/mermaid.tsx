'use client';
import { useEffect, useId, useState } from 'react';

interface MermaidProps {
  chart: string;
}

export function Mermaid({ chart }: MermaidProps) {
  const id = useId();
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
      const safeId = `mermaid-${id.replace(/:/g, '')}`;
      mermaid
        .render(safeId, chart)
        .then(({ svg: rendered }) => {
          if (!cancelled) setSvg(rendered);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(String(err));
        });
    });
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) return <pre className="text-red-500 text-sm">{error}</pre>;
  if (!svg) return <div className="h-32 animate-pulse bg-fd-muted rounded" />;
  return (
    <div
      className="my-6 flex justify-center overflow-x-auto [&>svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
