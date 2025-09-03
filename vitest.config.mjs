import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'src/tests/**',
      'tests/**',
      'src/**/tests/**',
    ],
    reporters: process.env.CI ? ['junit', 'default'] : ['default'],
    outputFile: process.env.CI ? 'junit.xml' : undefined,
    environment: 'node',
  },
});
