import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Vercel serves the contents of dist/ as a static site.
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      input: {
        // the app itself
        main: resolve(__dirname, 'index.html'),
        // the on-stage phone-mockup presenter view
        present: resolve(__dirname, 'present.html'),
      },
    },
  },
});
