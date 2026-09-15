import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'demo',
  resolve: {
    alias: {
      // The demo boots the batteries-included entry (engine + first-party plugins).
      'nilvn': fileURLToPath(new URL('./src/iife.ts', import.meta.url)),
    },
  },
  server: {
    port: 5180,
  },
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
  },
})
