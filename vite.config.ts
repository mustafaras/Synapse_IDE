import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Dev-only proxy to call local Ollama from the browser without CORS issues
      '/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        // keep path like /ollama/api/* -> http://localhost:11434/api/*
        rewrite: (p) => p.replace(/^\/ollama/, ''),
      },
      // Dev-only proxy for OpenAI to avoid browser CORS on SSE
      '/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: true,
        // keep path like /openai/v1/* -> https://api.openai.com/v1/*
        rewrite: (p) => p.replace(/^\/openai/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          monaco: ['@monaco-editor/react', 'monaco-editor']
        }
      }
    }
  },
})
