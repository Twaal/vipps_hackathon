import { defineConfig } from 'vite';

export default defineConfig({
  // Vercel serves the contents of dist/ as a static site.
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
