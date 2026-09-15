// `nilvn` → this package's iife entry (vite.config.ts): the engine with the
// first-party plugins registered, so nilvn.config.toml can `use` them by name.
import { createEngine } from 'nilvn'

const app = document.querySelector<HTMLDivElement>('#app')!

// The finale (result card + staff roll + replay) is the ending plugin's job,
// loaded from nilvn.config.toml — so dev and the bundled single file behave the same.
const engine = createEngine({ container: app })

// Handy for poking around in DevTools
Object.assign(window, { engine })

// Everything game-specific lives in nilvn.config.toml:
// plugins, path aliases, actors, command defaults, macros and the entry script.
await engine.loadConfig('./nilvn.config.toml')
await engine.start()
