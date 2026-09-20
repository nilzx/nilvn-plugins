// @nilvn/plugins — the first-party NilVN plugins: the runtime modules the engine
// registers, their manifests (the declarative half every host reads) and their
// UI strings. The engine itself ships no plugins; a host hands it this set:
//
//   createEngine({ container, ...withFirstParty() })         // ESM hosts
//   <script src="nilvn.iife.js">  →  ADV.createEngine(…)     // the batteries bundle
//
// Every module here is written the way a third-party plugin is: against the
// public types of @nilvn/engine only (type imports, erased at build), reaching
// the stage / audio / session through the capability objects on `ctx.plugin`.
// scripts/check-boundary.mjs keeps it that way — a relative import into the
// engine, or a value import from @nilvn/engine or @nilvn/core, fails the build.

import type { EnginePlugin, EngineOptions, PluginManifest } from '@nilvn/engine'
import { abreplay } from './plugins/abreplay.js'
import { animstudio } from './plugins/animstudio.js'
import { charfx } from './plugins/charfx.js'
import { choicefx } from './plugins/choicefx.js'
import { objectfx } from './plugins/objectfx.js'
import { screenfx } from './plugins/screenfx.js'
import { spriteanim } from './plugins/spriteanim.js'
import { textfx } from './plugins/textfx.js'
import { voicefx } from './plugins/voicefx.js'
import { allFirstPartyManifests } from './manifests.js'

export { abreplay, animstudio, charfx, choicefx, objectfx, screenfx, spriteanim, textfx, voicefx }
export * from './manifests.js'
export { PLUGIN_MESSAGES } from './messages.js'

/** The runtime modules, in registration order: the nine content plugins with an
 *  engine half. Scripts reach each by `[use <short name>]` or its id; the package
 *  manifest's `plugins` list activates them at load. (The in-game menu is the
 *  engine's own since 0.15.) */
export const firstPartyPlugins: readonly EnginePlugin[] = [screenfx, objectfx, textfx, charfx, choicefx, voicefx, spriteanim, animstudio, abreplay]

/** The `registry` + `manifests` pair for `createEngine`: every first-party
 *  module made available to `[use …]` / `enablePlugin` / a package's plugin
 *  list, each with its manifest attached (permissions, activation, messages).
 *  Spread it into your options; your own `registry` / `manifests` come after. */
export function withFirstParty(): { registry: EnginePlugin[]; manifests: PluginManifest[] } {
  return { registry: [...firstPartyPlugins], manifests: [...allFirstPartyManifests] }
}

/** `opts` with the first-party set registered (a host's own entries kept). */
export function firstPartyOptions(opts: EngineOptions): EngineOptions {
  const base = withFirstParty()
  return { ...opts, registry: [...base.registry, ...(opts.registry ?? [])], manifests: [...base.manifests, ...(opts.manifests ?? [])] }
}
