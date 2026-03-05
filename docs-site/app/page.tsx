import Link from 'next/link';

const features = [
  {
    title: 'AI Integration',
    href: '/docs/features/ai-features',
    description:
      'BYOK providers, agent mode, semantic search, next-edit prediction',
  },
  {
    title: 'Editor Extensions',
    href: '/docs/features/editor-extensions',
    description: 'Multi-cursor, snippets, minimap, Vim/Emacs keymaps',
  },
  {
    title: 'Collaboration',
    href: '/docs/features/collaboration',
    description:
      'Real-time editing with Yjs, comments, suggestions, share links',
  },
  {
    title: 'Export Formats',
    href: '/docs/features/export-formats',
    description: 'PDF, DOCX, EPUB, LaTeX, Pandoc, llms.txt',
  },
  {
    title: 'Plugin System',
    href: '/docs/features/plugin-system',
    description: 'Themes, remark/rehype plugins, extension marketplace',
  },
  {
    title: 'Architecture',
    href: '/docs/architecture',
    description:
      'Electron process model, Zod IPC, spec-driven dev',
  },
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="max-w-4xl w-full text-center space-y-6">
        <h1 className="text-6xl font-bold tracking-tight text-fd-foreground">
          MDXPad
        </h1>
        <p className="text-xl text-fd-muted-foreground">
          A macOS-first MDX editor built with Electron 39, React 19 &amp;
          TypeScript 5.9
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/docs/getting-started"
            className="inline-flex items-center justify-center rounded-md bg-fd-primary px-6 py-2.5 text-sm font-medium text-fd-primary-foreground shadow transition-colors hover:bg-fd-primary/90"
          >
            Get Started
          </Link>
          <Link
            href="/docs/features/editor-extensions"
            className="inline-flex items-center justify-center rounded-md border border-fd-border bg-fd-background px-6 py-2.5 text-sm font-medium text-fd-foreground shadow-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
          >
            Browse Features
          </Link>
        </div>
      </div>

      <div className="mt-20 grid max-w-4xl w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="group rounded-lg border border-fd-border bg-fd-card p-6 transition-colors hover:bg-fd-accent"
          >
            <h2 className="mb-2 font-semibold text-fd-card-foreground group-hover:text-fd-accent-foreground">
              {feature.title}
            </h2>
            <p className="text-sm text-fd-muted-foreground">
              {feature.description}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
