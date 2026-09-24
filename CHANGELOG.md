# Changelog

Notable changes to `@nilvn/plugins` (tag `plugins-v*`). The package has its own
version axis; each manifest declares the engine range it runs on.

## 0.3.3 — 2026-09-24

Requires `@nilvn/engine` ≥ 0.18 (every manifest's `engine` range).

### Added

- `spriteanim`: `[sprite … if=condition]` — a false condition takes the sprite off the stage (the command declares `ifFalse: 'handle'`), so a one-shot clickable sprite retires once its scene re-runs, as a `[hotspot … if=]` does.

### Changed

- `textfx`'s rainbow starts from `var(--nilvn-accent)` and `choicefx`'s sheen takes `--nilvn-choice-color` through `color-mix()`: no colour literals left in the plugins' styles (the default theme renders the sheen exactly as before). `pnpm typecheck` now rejects colour literals in `styles`.
- The demo's `[glitch]` flashes colour again, through the engine's camera colour channels, and cuts hard between frames.

## 0.3.2 — 2026-09-22

Requires `@nilvn/engine` ≥ 0.17 (every manifest's `engine` range).

### Added

- `objectfx`: `[layer … layer=back]` tucks a character or sprite behind the
  characters — the engine's new `back` band, between the background and the
  characters and still under the camera — for ambient particles and light
  shafts that must not cover a sprite. `front` / `world` are unchanged; the
  palette's Layer control offers the third value.

## 0.3.1 — 2026-09-21

The first published build of the 0.3 line: the 0.3.0 tag sat on a monorepo
snapshot whose engine version never reached npm, so it was not mirrored.
Content: 0.3.0, against the published `@nilvn/engine` 0.16.2.

## 0.3.0 — 2026-09-21

Requires `@nilvn/engine` ≥ 0.16 (every manifest's `engine` range).

### Added

- `screenfx`: `[transout]` / `[transin]` take `mask=` (a rule image — a
  luminance ramp: dark pixels change first) and `softness=` (edge width,
  default 0.1) in place of `type=`; the engine's rule-mask primitive draws it.
  For a direct old-to-new scene transition see the engine's `[trans …]`.
- `spriteanim`: `[sprite … onclick="…"]` makes the sprite clickable — the
  engine runs those script commands (one per line) on a click.

## 0.2.0 — 2026-09-20

Requires `@nilvn/engine` ≥ 0.15 (every manifest's `engine` range).

### Changed

- The demo game uses the engine's built-in title and ending pages, menu and
  settings (`[title]`, `[ending.true]` / `[ending.normal]`, `[menu]`,
  `[settings]`, `[saves]`, `[plugins.voicefx]` in its config); the local
  `ending.js` example plugin is gone. `pnpm bundle` output and `pnpm dev` open
  on the title page (`showTitle()`).

### Added

- `voicefx` declares its actor field (`actorFields: voice`) and settings
  (`[plugins.voicefx] enabled` / `level` — player-adjustable in the game's
  settings panel — and `wobble`); it reads them through `ctx.actorField` /
  `ctx.config` (engine ≥ 0.15).

### Breaking

- **`menu` removed.** The in-game menu is built into `@nilvn/engine` 0.15
  (saves, backlog, replays, auto / skip, settings — configured by `[menu]` /
  `[settings]` / `[saves]` in the work's config). `menuManifest`, the `menu`
  module, `FIRST_PARTY_IDS.menu` and the `plugin.menu.*` messages are gone;
  `firstPartyPlugins` has nine modules. `[use menu]` is ignored by the engine.

## 0.1.0 — 2026-09-15

- First release. The ten first-party plugins moved out of `@nilvn/engine`:
  `textfx`, `screenfx`, `charfx`, `objectfx`, `spriteanim`, `choicefx`,
  `voicefx`, `animstudio`, `abreplay` and `menu` — runtime modules, manifests
  with `messages` (`en` / `ja` / `zh`), `withFirstParty()` / `firstPartyOptions()`,
  the DOM-free `@nilvn/plugins/manifests` subpath and the batteries-included
  `@nilvn/plugins/iife` bundle (engine + plugins, what exported games run).
- Every runtime module imports only types from `@nilvn/engine` / `@nilvn/core`;
  `scripts/check-boundary.mjs` enforces it as part of `typecheck`.
- The in-game menu's strings are manifest `messages` (`plugin.menu.*`).
- The demo game (`demo/`), the game bundler (`bundle.mjs`: single-file or
  deployable folder) and the demo's audio generator (`gen-audio.mjs`).
