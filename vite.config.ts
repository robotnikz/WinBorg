import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // IMPORTANT for Electron: makes paths relative so they work with file:// protocol
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    'process.env.APP_VERSION': JSON.stringify(process.env.npm_package_version),
  },
});
