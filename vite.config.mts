/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react() as any],
  test: {
    globals: true,
    pool: 'forks',
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      allowExternal: true,
      thresholds: {
        statements: 30,
        branches: 25,
        functions: 20,
        lines: 30,
      },
    },
  },
  base: './', // IMPORTANT for Electron: makes paths relative so they work with file:// protocol
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    'process.env.APP_VERSION': JSON.stringify(process.env.npm_package_version),
  },
} as any);
