import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'out/workers',
    emptyOutDir: false,
    ssr: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/workers/index/index.ts'),
        jobs: resolve(__dirname, 'src/workers/jobs/index.ts')
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
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
})
