import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'out',
    emptyOutDir: false,
    ssr: true,
    rollupOptions: {
      input: {
        'main/index': resolve(__dirname, 'src/main/index.ts'),
        'preload/index': resolve(__dirname, 'src/preload/index.ts'),
        'main/test-day-one-sqlite': resolve(__dirname, 'src/main/test-day-one-sqlite.ts')
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
        'fs',
        'node:module',
        'module'
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
