# @nilvn/plugins

The first-party plugins for the [NilVN](https://github.com/nilzx/nilvn-engine)
visual-novel engine: inline text effects, screen and camera effects, character
motion, generic object verbs, sprite-sheet animation, animated choices, typing
blips, keyframe choreography and replay segments. The
engine itself ships none of these — it is a runtime with a capability-sandboxed
plugin host — so a game that wants them registers this set.

Every plugin here is written the way a third-party plugin is: against the public
types of `@nilvn/engine` only, reaching the stage, audio and session through the
capability objects on `ctx.plugin`. That is deliberate. If a first-party plugin
could not be written this way, the plugin SDK would be missing something.

```bash
pnpm add @nilvn/engine @nilvn/plugins
```

## Use

**ESM host.** Spread the first-party set into `createEngine`; scripts then reach
each plugin by short name, and a script package's plugin list activates them.

```ts
import { createEngine } from '@nilvn/engine'
import { withFirstParty } from '@nilvn/plugins'

const engine = createEngine({ ...withFirstParty(), container: document.getElementById('app')! })
engine.loadSource('[use textfx screenfx]\nyuki: {wave:Hi!}\n[shake]')
await engine.start()
```

`withFirstParty()` returns `{ registry, manifests }`: every runtime module made
available to `[use …]` / `enablePlugin` / a package's `plugins` list, each with
its manifest attached (permissions, activation, messages). Your own `registry` /
`manifests` entries go after the spread. `firstPartyOptions(opts)` does the same
merge for an existing options object.

**Batteries-included script.** `@nilvn/plugins/iife` is the whole
`@nilvn/engine` surface as a global `ADV`, with `createEngine` already carrying
this set — what NilVN Studio inlines into exported games. The file is
`node_modules/@nilvn/plugins/dist/nilvn.iife.js` after `pnpm add @nilvn/plugins`
(`dist/` is a build output, not checked in), or straight from a CDN:
`https://cdn.jsdelivr.net/npm/@nilvn/plugins/dist/nilvn.iife.js`.

```html
<script src="https://cdn.jsdelivr.net/npm/@nilvn/plugins/dist/nilvn.iife.js"></script>
<script>
  const engine = ADV.createEngine({ container: document.getElementById('app') })
  engine.loadSource('[use textfx]\nyuki: Hello')
  engine.start()
</script>
```

**Manifests only.** `@nilvn/plugins/manifests` is DOM-free: the manifests, the
id table and the plugin message catalogs, for tools that describe the plugins
without running them (an editor's plugin panel, an authoring linter).

```ts
import { firstPartyManifests, firstPartyManifest, FIRST_PARTY_IDS, defaultFirstPartyRefs } from '@nilvn/plugins/manifests'
import { commandRegistry } from '@nilvn/core'

const commands = commandRegistry(firstPartyManifests) // built-ins + every plugin command, for the serializer
```

## The plugins

Activate with `[use short-name]`, `[use app.nilvn.<short-name>]`, the config's
`[plugins] use`, or `createEngine({ use })`. Objects are addressed as `screen`
(the whole picture), `camera`, `character:<actor id>`, `sprite:<id>` and
`window:dialog`; commands that take `target=` accept the bare actor / sprite id
with `kind=character` (default) or `kind=sprite`.

| Plugin | Adds |
|---|---|
| `textfx` | `{wave:…}` `{shaky:…}` `{rainbow:…}` `{pop:…}` `{fadein:…}` inline text effects |
| `screenfx` | `[shake]` `[flash]` `[transout]` `[transin]` |
| `charfx` | `[charfx id hop\|nod\|shake\|swing]` `[move id to=…]` |
| `objectfx` | `[fade]` `[scale]` `[opacity]` `[visibility]` `[layer]` on any object |
| `spriteanim` | `[sprite id sheet frames= fps=]` `[hidesprite id]` — sprite-sheet animation as a stage object; `onclick=` makes the sprite clickable (the engine runs those script commands, one per line). |
| `choicefx` | Animated choice buttons (no markup) |
| `voicefx` | Synthesized per-character typing blips at each actor's pitch (no markup) |
| `animstudio` | Keyframe choreography commands NilVN Studio's timeline records (Studio-only: the encoding is not meant to be written by hand) |
| `abreplay` | A–B replay segments for a replay gallery |

`voicerecord` has a manifest here too but no runtime half: it is the studio's
per-line voice recording UI, listed so hosts see one inventory.

### `textfx` — inline text effects

`{wave:text}` `{shaky:text}` `{rainbow:text}` `{pop:text}` `{fadein:text}`.
Pure CSS, staggered per character.

### `screenfx` — screen and camera effects

| Command | Parameters | Effect |
|---|---|---|
| `[shake]` | `strength=12` `duration=0.45` `target=screen` `kind=character` | Decaying random rumble on the camera, a character or a sprite. Composed as an offset, so a shaken camera keeps its pan. |
| `[flash]` | `color=#ffffff` `duration=0.4` | Full-screen flash that fades out. |
| `[transout]` | `type=wipe\|circle\|blinds` `dir=right\|left\|up\|down` `duration=0.6` `color=#000000` `mask=` `softness=0.1` | Cover the screen with a shaped transition (then change the scene). `mask=` names a rule image (a luminance ramp) instead of a shape. For a direct old-to-new transition use the engine's `[trans …]`. |
| `[transin]` | same | Reveal the screen with the shape (or rule) played backwards. |

### `charfx` — character motion

| Command | Parameters | Effect |
|---|---|---|
| `[charfx id preset]` | `preset=hop\|nod\|shake\|swing` `duration=0.45` | A pose gesture on a character. |
| `[move id]` | `to=left\|center\|right` `time=0.45` | Slide a character to another stage slot. |

### `objectfx` — generic object verbs

All take `target=` and `kind=character\|sprite` (or `target=screen` for the camera).

| Command | Parameters | Effect |
|---|---|---|
| `[fade]` | `dir=in\|out` `duration=0.5` | Fade an object in or out. |
| `[scale]` | `to=1.2` `duration=0.4` | Scale an object (on the camera: zoom). |
| `[opacity]` | `to=0.5` `duration=0` | Set an object's opacity. |
| `[visibility]` | `vis=hide\|show` | Hide or show an object without a fade. |
| `[layer]` | `layer=front\|back\|world` | Lift a character or sprite in front of the dialogue box (`front`, no longer camera-shaken), tuck it behind the characters (`back`: between the background and the characters, still under the camera — ambient particles, light shafts; engine ≥ 0.17) or return it to the stage (`world`). |

### `spriteanim` — sprite-sheet animation

| Command | Parameters | Effect |
|---|---|---|
| `[sprite id sheet]` | `frames=1` `fps=12` `loop=true` `at=center` `height=30` `y=` `scale=` `rotation=` `fade=0.3` | Play a single-row sprite sheet as a frame loop. Frames are square: the sprite is drawn at `height` with a 1:1 aspect ratio, so a sheet of N frames is N·h × h pixels. `height` is a percentage of the stage height; `y` / `scale` / `rotation` seed the resting transform. The sprite becomes a transformable object (`sprite:<id>`) that every object effect can target. |
| `[hidesprite id]` | `fade=0.3` | Remove the sprite. |

The `sprite` kind is declared with the engine's standard channel names
(`recordable: ['x', 'y', 'scale', 'rotation', 'opacity', 'visible', 'band']`),
so it records and animates like a character with no engine import.

### `choicefx` — choice button animation

No markup: every choices prompt slides its buttons in one by one and adds a
shine on hover.

### `voicefx` — typing blips

No markup: while a line types out, a short synthesized blip plays per character
at the speaker's pitch — the plugin's actor field `voice` (`[actors.yuki] voice = 360`
in the config, or `[actor yuki voice=360]` in the script; Hz), otherwise a stable
pitch derived from the actor id. Silent for whitespace and punctuation, and for
any line that carries a real `[voice]` clip. Uses the Web Audio API; no files.
Settings (`[plugins.voicefx]`): `enabled` and `level` (also in the game's settings
panel, per player), `wobble` (pitch jitter, author-only).

### `animstudio` — keyframe animation

`[anim …]`, `[eventframe …]`, `[loopstart …]` and `[loopstop …]` play keyframe
tracks recorded in NilVN Studio's timeline (multi-object choreography including
the camera, and background loops on one object). The compact keyframe encoding
is produced by NilVN Studio — it is not documented for hand-written scripts, so
without Studio leave these commands aside; the plugin hands it to the stage
capability as written and the engine decodes it. The plugin also owns the save-state slice
that keeps loops running across a save and load.

### `abreplay` — replay segments

`[replaydef id= title= label=]` declares a replayable segment and
`[replayend id]` marks where it ends. Passing the end marker in normal play
unlocks the segment in the in-game menu's replay gallery; the studio emits these
from its A–B replay panel. Declarations are read when their file is parsed, so
in a multi-file work they all belong in the **entry** script — the end markers
stay in the scenes they close.

## Exports

| Export | What for |
|---|---|
| `firstPartyPlugins`, and each plugin by name (`textfx`, `screenfx`, …, `abreplay`) | The runtime modules (`EnginePlugin`). |
| `withFirstParty()`, `firstPartyOptions(opts)` | The `registry` + `manifests` pair for `createEngine`. |
| `firstPartyManifests`, `allFirstPartyManifests`, `firstPartyManifest(nameOrId)`, `isFirstPartyPlugin(nameOrId)`, `FIRST_PARTY_IDS`, `defaultFirstPartyRefs()`, `firstPartyCommandMap()`, `PLUGIN_MESSAGES` | The declarative side, also at `@nilvn/plugins/manifests` (DOM-free). `FIRST_PARTY_IDS` and `firstPartyManifests` include the editor-only `voicerecord`, so `isFirstPartyPlugin('voicerecord')` is true while `[use voicerecord]` has no runtime module to activate. |
| `@nilvn/plugins/iife` | `dist/nilvn.iife.js`, the batteries-included bundle (global `ADV`). |

Ids live under the reserved `app.nilvn.` namespace, and a plugin there also
answers to its short name — the engine aliases it on registration, and
`resolvePluginId` in `@nilvn/core` is the same rule. Third-party ids use their
own reverse-DNS domain.

## Writing your own

Start from [`@nilvn/plugin-sdk`](https://www.npmjs.com/package/@nilvn/plugin-sdk):
the manifest format, the permissions and capability objects, the lifecycle, a
template package and the generated `plugin-spec.json`. The modules under
[`src/plugins/`](src/plugins/) are worked examples of every extension point —
text effects, commands, effects bound to object kinds, a contributed object
kind, hooks, a save-state slice, a UI layer with timers. Plugin CSS draws with
the engine's theme tokens (`var(--nilvn-panel-bg)`, `var(--nilvn-accent)`, …;
see the engine's [Theming](https://github.com/nilzx/nilvn-engine/blob/main/packages/engine/docs/api.md#theming))
rather than colour literals, so a plugin's panel follows the work's theme; `ctx.theme`
reads the current values.

## Working in the repository

These are contributor commands inside this repository — an npm user builds with
their own bundler or the CDN script (see the engine's
[Getting started](https://github.com/nilzx/nilvn-engine/blob/main/packages/engine/docs/getting-started.md)).

```bash
pnpm dev           # the demo game on http://localhost:5180 (demo/)
pnpm build         # dist/: ESM + .d.ts + the batteries IIFE
pnpm typecheck     # tsc + scripts/check-boundary.mjs
pnpm bundle demo/public         # pack a game directory into one double-clickable .html
pnpm bundle demo/public --dir   # …or a deployable folder
pnpm gen:audio     # regenerate the demo's synthesized BGM / SFX
```

`scripts/check-boundary.mjs` fails the build when a plugin module imports
anything but types from `@nilvn/engine` / `@nilvn/core`, or reaches outside
`src/plugins/`. Tests live in `test/` and run with `pnpm test` from the
repository root; `test/iife-smoke.test.ts` boots the minified bundle.

## License

MIT.
