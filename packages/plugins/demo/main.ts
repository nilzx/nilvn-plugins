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

// The finale (result card + staff roll + replay) is the ending plugin's job,
// loaded from nilvn.config.toml — so dev and the bundled builds behave the same.
const engine = createEngine({ container: app, catalogs, lang, defaultLang, languages })

// Handy for poking around in DevTools
Object.assign(window, { engine })

// Everything game-specific lives in nilvn.config.toml:
// plugins, path aliases, actors, command defaults, macros and the entry script.
await engine.loadConfig('./nilvn.config.toml')
await engine.start()
