// `nilvn` → this package's iife entry (vite.config.ts): the engine with the
// first-party plugins registered, so nilvn.config.toml can `use` them by name.
import { createEngine } from 'nilvn'

const app = document.querySelector<HTMLDivElement>('#app')!

// The multi-language text lives in catalogs.json (one catalog per language);
// the engine needs it before boot so @key references in the script resolve.
// ?lang= picks the language, otherwise the config's defaultLang.
const catalogs: Record<string, Record<string, string>> = await (await fetch('./catalogs.json')).json()
const languages = Object.keys(catalogs)
const config = await (await fetch('./nilvn.config.toml')).text()
const defaultLang = /defaultLang\s*=\s*"([^"]+)"/.exec(config)?.[1] ?? languages[0] ?? 'en'
const want = new URLSearchParams(location.search).get('lang')
const lang = want && languages.includes(want) ? want : defaultLang

// The title page, the two endings (result card + credits) and the in-game menu
// are the engine's own, configured in nilvn.config.toml — dev and the bundled
// builds behave the same.
const engine = createEngine({ container: app, catalogs, lang, defaultLang, languages })

// Handy for poking around in DevTools
Object.assign(window, { engine })

// Everything game-specific lives in nilvn.config.toml:
// plugins, path aliases, actors, command defaults, macros, the entry script,
// the title / ending pages, the menu and the settings panel.
await engine.loadConfig('./nilvn.config.toml')
await engine.showTitle() // start() would skip the title page; the page's New game calls it
