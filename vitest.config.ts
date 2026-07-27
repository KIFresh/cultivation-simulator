import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', '.reasonix', '.hermes'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/generated': path.resolve(__dirname, './src/generated'),
    },
  },
});
