// The ONE definition of the batteries-included IIFE bundle (global `ADV`): the
// engine plus the first-party plugins, from src/iife.ts. It has three consumers
// that deliberately share this module so they can never drift apart:
//
//   - the NilVN Studio hosts (closed source) call it from their vite configs
//     and write the result to their public/ as the file exports inline into
//     playable builds (dev start, source hot update, and `vite build`);
//   - packages/plugins/test/iife-smoke.test.ts builds the same bytes in memory
//     and boots a real engine from them, so `pnpm test` exercises the SHIPPED
//     artifact form — minified, TOML stub and all — with `[use textfx]` on.
//
// The bare engine (no plugins) has its own builder, packages/engine/scripts/
// build-iife.ts; this one bundles @nilvn/engine from the workspace source (or the
// installed package outside the monorepo) together with the plugins.

import { promises as fs } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build as esbuild } from 'esbuild'

const fromHere = (p: string): string => fileURLToPath(new URL(p, import.meta.url))

/** The file name exports and the desktop player look for inside a pack. It IS
 *  the engine (with the first-party plugins), hence the historical name. */
export const ENGINE_IIFE = 'nilvn-engine.iife.js'

/** Bundle engine + first-party plugins to the self-contained IIFE and return the bytes. */
export async function buildEngineIifeCode(): Promise<string> {
  const result = await esbuild({
    entryPoints: [fromHere('../src/iife.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'ADV',
    minify: true,
    write: false,
    logLevel: 'silent',
    // The single-file export never parses TOML at runtime, so drop the parser.
    // (If engine code ever DOES parse TOML at play time, the stub returns {} —
    // the iife-smoke test playing real script through these bytes is the tripwire.)
    plugins: [
      {
        name: 'stub-smol-toml',
        setup(b) {
          b.onResolve({ filter: /^smol-toml$/ }, (a) => ({ path: a.path, namespace: 'stub-toml' }))
          b.onLoad({ filter: /.*/, namespace: 'stub-toml' }, () => ({
            contents: 'export const parse = () => ({})',
            loader: 'js',
          }))
        },
      },
    ],
  })
  return result.outputFiles[0]!.text
}

/** Build and drop the bundle at `dest`, writing only when the bytes changed
 *  (avoids a dev watch/reload loop). */
export async function writeEngineIife(dest: string): Promise<void> {
  const code = await buildEngineIifeCode()
  const prev = await fs.readFile(dest, 'utf8').catch(() => '')
  if (prev !== code) await fs.writeFile(dest, code)
}

// CLI form: `node --experimental-strip-types build-iife.ts <dest>`.
// The iife-smoke test builds through this child process because esbuild's JS
// API refuses to run inside the test's jsdom environment.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dest = process.argv[2]
  if (!dest) throw new Error('usage: build-iife.ts <dest>')
  await writeEngineIife(dest)
}
