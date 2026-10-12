import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

// `--mode artifact` builds one self-contained page for claude.ai artifacts
// (see scripts/build-artifact.mjs): fonts come from Google Fonts instead of the bundle.
// The character gallery (gallery.html) is a dev-only page served by `npm run dev`.
export default defineConfig(({ mode }) => ({
  plugins: [preact()],
  base: './',
  resolve:
    mode === 'artifact'
      ? { alias: [{ find: /^\.\/fonts$/, replacement: fileURLToPath(new URL('./src/empty.ts', import.meta.url)) }] }
      : undefined,
  build: {
    target: 'es2020',
    outDir: mode === 'artifact' ? 'dist-artifact' : 'dist',
    cssCodeSplit: false,
    modulePreload: mode === 'artifact' ? false : undefined,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}) as any);
