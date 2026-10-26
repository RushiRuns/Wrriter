import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'out/preload',
    emptyOutDir: true,
    ssr: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/preload/index.ts')
      },
      output: {
        entryFileNames: '[name].js',
        format: 'cjs'
      },
      external: ['electron']
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
})
