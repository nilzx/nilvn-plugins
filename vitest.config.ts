import { defineConfig } from 'vitest/config'

// Unit tests live under `packages/plugins/test/*.test.ts` and import the package
// source directly — vitest transpiles the TypeScript with esbuild, so there is
// no build step. `@nilvn/engine` / `@nilvn/core` resolve to the installed
// packages (this repository depends on the published engine). Default
// environment is `node`; a test that needs a DOM opts in per-file with a
// `// @vitest-environment jsdom` pragma.
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts'],
    environment: 'node',
  },
})
