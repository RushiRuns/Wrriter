import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'out/main',
    emptyOutDir: true,
    ssr: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/main/index.ts'),
        'worker-index': resolve(__dirname, 'src/workers/index/index.ts'),
        'test-day-one-sqlite': resolve(__dirname, 'src/main/test-day-one-sqlite.ts')
      },
      output: {
        entryFileNames: '[name].js',
        format: 'cjs'
      },
      external: [
        'electron',
        'better-sqlite3',
        'node:worker_threads',
        'worker_threads',
        'node:path',
        'path',
        'node:fs',
        'fs'
      ]
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main')
    }
  }
})
