import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Inside the NilVN monorepo the sibling engine sources exist: the demo then runs
// against them (live edits, never a stale dist). In the public repository they
// do not, and the installed @nilvn/engine / @nilvn/core are used.
const monorepoEngine = fileURLToPath(new URL('../engine/src/index.ts', import.meta.url))
const monorepoCore = fileURLToPath(new URL('../core/src/index.ts', import.meta.url))
const sourceAliases: Record<string, string> = existsSync(monorepoEngine) ? { '@nilvn/engine': monorepoEngine, '@nilvn/core': monorepoCore } : {}

export default defineConfig({
  root: 'demo',
  resolve: {
    alias: {
      // The demo boots the batteries-included entry (engine + first-party plugins).
      'nilvn': fileURLToPath(new URL('./src/iife.ts', import.meta.url)),
      ...sourceAliases,
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
