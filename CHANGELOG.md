# Changelog

Notable changes to `@nilvn/plugins` (tag `plugins-v*`). The package has its own
version axis; each manifest declares the engine range it runs on.

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
