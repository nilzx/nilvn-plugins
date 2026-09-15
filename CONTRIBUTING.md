# Contributing

Thanks for your interest. This repository holds the first-party plugins for the
[NilVN engine](https://github.com/nilzx/nilvn-engine), published as
`@nilvn/plugins`.

## Before opening a pull request

- Open an issue first for a new plugin or a behavior change, so it can be
  discussed; small fixes can go straight to a pull request.
- For a bug, include the `@nilvn/plugins` and `@nilvn/engine` versions, a
  minimal script that shows it, and the diagnostics you got (`engine.diagnostics`).

## Working in the repository

Node 22 or newer and pnpm 11. `pnpm install` pulls `@nilvn/core`,
`@nilvn/engine` and `@nilvn/plugin-sdk` from npm.

```bash
pnpm test              # vitest, including a boot of the built bundle
pnpm typecheck         # tsc + the plugin boundary guard
pnpm typecheck:test    # the test suites themselves
pnpm build             # dist/: ESM + .d.ts + nilvn.iife.js
pnpm pack:smoke        # pack the tarball and consume it from a throwaway project
pnpm demo              # the demo game on http://localhost:5180
```

CI runs exactly these.

## Ground rules

- **A first-party plugin is written like a third-party one.** Runtime modules
  import only types from `@nilvn/engine` / `@nilvn/core`, reach the runtime
  through the capability objects on `ctx.plugin`, and never import anything
  outside `src/plugins/`. `scripts/check-boundary.mjs` fails `typecheck`
  otherwise. When a plugin needs something the capabilities do not offer, the
  fix belongs in the engine (open an issue there), not here.
- A new plugin is a module under `src/plugins/`, a manifest in
  `src/manifests.ts`, its `messages` in `src/messages.ts` (English first) and
  tests under `test/`.
- Code, comments, documentation and commit messages are English.

## Releases

`pnpm version:set plugins x.y.z` sets the package version; pushing the tag
`plugins-vx.y.z` publishes to npm.
