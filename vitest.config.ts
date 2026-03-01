import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    environmentMatchGlobs: [
      ['src/main/**/*.test.ts', 'node'],
      ['src/main/**/*.test.tsx', 'node'],
      ['src/preload/**/*.test.ts', 'node'],
      ['src/preload/**/*.test.tsx', 'node'],
      ['tests/integration/**/*.test.ts', 'node'],
      ['tests/integration/**/*.test.tsx', 'node'],
      ['tests/security/**/*.test.ts', 'node'],
      ['tests/security/**/*.test.tsx', 'node'],
    ],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@preload': resolve(__dirname, 'src/preload'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@ui': resolve(__dirname, 'src/renderer/components/ui'),
    },
  },
});
