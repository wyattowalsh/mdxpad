import { ImageResponse } from 'next/og';
import { source } from '@/lib/source';
import type { NextRequest } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const page = source.getPage(slug);

  const title = page?.data.title ?? 'MDXPad Documentation';
  const description =
    page?.data.description ?? 'A macOS-first MDX editor';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '64px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        }}
      >
        <p
          style={{
            fontSize: 20,
            color: '#94a3b8',
            marginBottom: 16,
            fontFamily: 'sans-serif',
          }}
        >
          MDXPad Documentation
        </p>
        <h1
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: '#f1f5f9',
            lineHeight: 1.1,
            marginBottom: 20,
            fontFamily: 'sans-serif',
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 24,
            color: '#94a3b8',
            fontFamily: 'sans-serif',
          }}
        >
          {description}
        </p>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
