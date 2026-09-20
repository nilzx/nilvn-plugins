# Changelog

Notable changes to `@nilvn/plugins` (tag `plugins-v*`). The package has its own
version axis; each manifest declares the engine range it runs on.

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
