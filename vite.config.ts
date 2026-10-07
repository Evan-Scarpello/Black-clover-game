import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// The character gallery (gallery.html) is a dev-only page served by `npm run dev`.
export default defineConfig({
  plugins: [preact()],
  base: './',
  build: {
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as any);
