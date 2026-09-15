# NilVN plugins

[![CI](https://github.com/nilzx/nilvn-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/nilzx/nilvn-plugins/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@nilvn/plugins)](https://www.npmjs.com/package/@nilvn/plugins)

The first-party plugins for the [NilVN](https://github.com/nilzx/nilvn-engine)
visual-novel engine, published as [`@nilvn/plugins`](packages/plugins): inline
text effects, screen and camera effects, character motion, generic object verbs,
sprite-sheet animation, animated choices, typing blips, keyframe choreography,
replay segments and the finished game's menu — plus the batteries-included
engine bundle that exported games run.

The engine ships none of these itself. Every plugin here is written the way a
third-party plugin is — against the public types of `@nilvn/engine`, reaching
the runtime through the capability objects on `ctx.plugin` — and a boundary
check keeps it that way. That rule is the point of this repository: if a
first-party plugin could not be written like yours, the SDK was missing
something, and the fix goes into the engine as a capability, never into the
plugin as an import.

## Quick start

```bash
pnpm add @nilvn/engine @nilvn/plugins
```

```ts
import { createEngine } from '@nilvn/engine'
import { withFirstParty } from '@nilvn/plugins'

const engine = createEngine({ ...withFirstParty(), container: document.getElementById('app')! })
engine.loadSource('[use textfx screenfx menu]\nyuki: {wave:Hi!}\n[shake]')
await engine.start()
```

Or one `<script>`: `@nilvn/plugins/iife` — `node_modules/@nilvn/plugins/dist/nilvn.iife.js`
after installing, or `https://cdn.jsdelivr.net/npm/@nilvn/plugins/dist/nilvn.iife.js`
— defines a global `ADV` whose `createEngine` already carries the set (`dist/`
is a build output, not checked in).

**Try it:** the demo game (`packages/plugins/demo/`) runs at
[nilzx.github.io/nilvn-plugins](https://nilzx.github.io/nilvn-plugins/), rebuilt
from `main` by the Demo workflow.

The plugins, their commands and parameters: [`packages/plugins/README.md`](packages/plugins/README.md).
Writing your own: [`@nilvn/plugin-sdk`](https://www.npmjs.com/package/@nilvn/plugin-sdk).

## Repository

```
packages/
  plugins/      @nilvn/plugins   src/plugins/ (the modules) · src/manifests.ts · src/messages.ts · src/iife.ts
                                 demo/ (the showcase game) · scripts/ (IIFE builder, game bundler, boundary check)
scripts/        set-version.mjs · pack-smoke.mjs
```

```bash
pnpm install           # pulls @nilvn/core / @nilvn/engine / @nilvn/plugin-sdk from npm
pnpm test              # vitest, including a boot of the built bundle
pnpm typecheck         # tsc + the plugin boundary guard
pnpm typecheck:test
pnpm build             # dist/: ESM + .d.ts + nilvn.iife.js
pnpm pack:smoke        # pack the tarball and consume it from a throwaway project
pnpm demo              # the demo game on http://localhost:5180
pnpm version:set plugins 0.2.0
```

Versioned on its own axis (`plugins-v*` tags → npm); each manifest declares the
engine range it runs on. Requires Node 22+ and pnpm. Contributions welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md): a new plugin is a module + manifest +
messages + tests, and it must pass the boundary check. Release history:
[CHANGELOG.md](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).
