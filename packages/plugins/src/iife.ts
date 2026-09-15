// The batteries-included bundle entry (`@nilvn/plugins/iife` → dist/nilvn.iife.js,
// global `ADV`): the whole @nilvn/engine surface with `createEngine` pre-loaded
// with the first-party plugin set, so a `<script>` host, a single-file export or
// the desktop player boots a full engine with `ADV.createEngine({ container })`
// and `[use textfx]` / a package's plugin list just works. Everything else is the
// engine's own export, untouched.
export * from '@nilvn/engine'
export * from './index.js'
import { createEngine as bare, type Engine, type EngineOptions } from '@nilvn/engine'
import { firstPartyOptions } from './index.js'

/** `@nilvn/engine`'s createEngine with the first-party plugins registered. */
export function createEngine(opts: EngineOptions): Engine {
  return bare(firstPartyOptions(opts))
}
