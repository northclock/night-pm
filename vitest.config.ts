import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 120_000,
    hookTimeout: 30_000,
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      electron: './src/test/__mocks__/electron.ts',
    },
  },
});
