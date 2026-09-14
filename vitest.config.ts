import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Isolated from the preserved Vite prototype config: production runs Next.js.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  test: { include: ['tests/**/*.test.ts'] },
});
