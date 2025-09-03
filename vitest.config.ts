import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/styles': path.resolve(__dirname, './src/styles'),
      '@/contexts': path.resolve(__dirname, './src/contexts'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/assets': path.resolve(__dirname, './src/assets'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/setupTests.ts'],
    include: [
      'tests/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'src/tests/**', // in-app/manual harness tests
      'src/**/tests/**',
    ],
    reporters: process.env.CI ? ['junit', 'default'] : ['default'],
    outputFile: process.env.CI ? 'junit.xml' : undefined,
    coverage: {
      provider: 'v8',
      enabled: false,
    },
  },
})
