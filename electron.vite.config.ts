import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      sourcemap: !isProduction,
      lib: {
        entry: resolve(__dirname, 'src/main/index.ts'),
      },
    },
    resolve: {
      alias: {
        '@main': resolve(__dirname, 'src/main'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },
  preload: {
    // Keep preload self-contained for sandboxed renderers.
    // Externalized runtime deps (e.g. zod) are not available via sandboxed preload require.
    plugins: [],
    build: {
      outDir: 'dist/preload',
      sourcemap: !isProduction,
      lib: {
        entry: resolve(__dirname, 'src/preload/index.ts'),
        formats: ['cjs'],
      },
      rollupOptions: {
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
    resolve: {
      alias: {
        '@preload': resolve(__dirname, 'src/preload'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    base: './',
    worker: {
      format: 'es',
    },
    resolve: {
      conditions: ['worker'],
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared'),
        '@ui': resolve(__dirname, 'src/renderer/components/ui'),
      },
    },
    build: {
      outDir: 'dist/renderer',
      sourcemap: !isProduction,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/index.html'),
          'preview-frame': resolve(__dirname, 'src/renderer/preview-frame/index.html'),
          'code-sandbox': resolve(__dirname, 'src/renderer/code-sandbox.html'),
        },
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            codemirror: [
              '@codemirror/state',
              '@codemirror/view',
              '@codemirror/commands',
              '@codemirror/language',
              '@codemirror/autocomplete',
              '@codemirror/search',
              '@codemirror/lint',
            ],
            radix: [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-popover',
              '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-scroll-area',
            ],
            remark: ['remark-gfm', 'remark-frontmatter', 'rehype-highlight', '@mdx-js/mdx'],
          },
        },
      },
    },
  },
});
