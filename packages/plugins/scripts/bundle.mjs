#!/usr/bin/env node
// Package an ADV game into something you can hand to someone else.
//
//   pnpm bundle <gameDir>            -> single self-contained .html (double-click to play)
//   pnpm bundle <gameDir> --dir      -> a deployable folder (serve over http)
//
// A "gameDir" is any folder containing an nilvn.config.toml plus the script,
// assets and plugins it references. Nothing in here is demo-specific. The engine
// bundled in is the batteries-included one (src/iife.ts: @nilvn/engine + the
// first-party plugins), so `use = ["textfx", …]` resolves without a fetch.

import { build } from 'esbuild'
import { parse as parseToml } from 'smol-toml'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(import.meta.url), '../..')
const ENGINE_ENTRY = path.join(root, 'src/iife.ts')

const MIME = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.nvn': 'text/plain',
  '.toml': 'application/toml',
}

function mimeOf(file) {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
}

function parseArgs(argv) {
  const opts = { dir: false, minify: true, out: null, gameDir: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dir' || a === '-d') opts.dir = true
    else if (a === '--no-minify') opts.minify = false
    else if (a === '--out' || a === '-o') opts.out = argv[++i]
    else if (!a.startsWith('-')) opts.gameDir = a
    else throw new Error(`Unknown option: ${a}`)
  }
  if (!opts.gameDir) throw new Error('Usage: pnpm bundle <gameDir> [--dir] [--out <path>] [--no-minify]')
  return opts
}

/** Recursively list files under dir, returning paths relative to it (posix-style) */
async function walk(dir, base = dir) {
  const out = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full, base)))
    else out.push(path.relative(base, full).split(path.sep).join('/'))
  }
  return out
}

function slug(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'game'
  )
}

/** Bundle the engine + first-party plugins to an IIFE exposing a global `ADV`. */
async function bundleEngine({ minify, stubToml }) {
  const plugins = []
  if (stubToml) {
    // The single-file build never reads TOML at runtime (config is pre-parsed),
    // so drop the parser to keep the bundle small.
    plugins.push({
      name: 'stub-smol-toml',
      setup(b) {
        b.onResolve({ filter: /^smol-toml$/ }, (a) => ({ path: a.path, namespace: 'stub-toml' }))
        b.onLoad({ filter: /.*/, namespace: 'stub-toml' }, () => ({
          contents: 'export const parse = () => ({})',
          loader: 'js',
        }))
      },
    })
  }
  const result = await build({
    entryPoints: [ENGINE_ENTRY],
    bundle: true,
    format: 'iife',
    globalName: 'ADV',
    minify,
    write: false,
    plugins,
    logLevel: 'silent',
  })
  return result.outputFiles[0].text
}

/** Bundle one external JS plugin to an IIFE returning its default export. */
async function bundlePlugin(file, name, minify) {
  const result = await build({
    entryPoints: [file],
    bundle: true,
    format: 'iife',
    globalName: name,
    minify,
    write: false,
    logLevel: 'silent',
  })
  return result.outputFiles[0].text
}

const PAGE_CSS = `
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:#0b0d16;display:flex;align-items:center;justify-content:center;overflow:hidden}
#app{width:min(100vw,177.78vh)}
`

function htmlShell({ title, head = '', body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeHtml(title)}</title>
<style>${PAGE_CSS}</style>
${head}
</head>
<body>
<div id="app"></div>
${body}
</body>
</html>
`
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
}

/** Inline everything into one HTML file (assets as data URIs, plugins as objects). */
async function buildSingleFile(gameDir, config, scriptText, minify) {
  const entry = config.game?.entry
  const title = config.game?.title ?? 'ADV Game'

  // Optional multi-language content catalogs (catalogs.json). Shipped to the
  // engine so the in-game menu can switch language; boot picks it from ?lang=.
  let catalogs = {}
  try {
    catalogs = JSON.parse(await fs.readFile(path.join(gameDir, 'catalogs.json'), 'utf8'))
  } catch {
    /* no catalogs.json — single-language game */
  }
  const languages = Object.keys(catalogs)
  const defaultLang = config.game?.defaultLang ?? languages[0] ?? 'en'

  // External plugins listed in [plugins].use become inlined objects; first-party
  // names (screenfx, ...) stay in `use` for the engine to activate by name.
  const useList = config.plugins?.use ?? []
  const external = useList.filter((n) => n.includes('/') || n.includes('.'))
  const builtinUse = useList.filter((n) => !external.includes(n))

  const pluginChunks = []
  for (let i = 0; i < external.length; i++) {
    const file = path.join(gameDir, external[i])
    pluginChunks.push(await bundlePlugin(file, `__nilvnPlugin${i}`, minify))
  }

  // Asset table: every referenced file except the entry script and the plugins
  // we already inlined (those would just be dead weight as data URIs).
  const skip = new Set([entry, ...external].filter(Boolean))
  const assets = {}
  for (const rel of await walk(gameDir)) {
    if (skip.has(rel) || rel.endsWith('.toml') || rel.endsWith('.html') || rel === 'catalogs.json') continue
    const buf = await fs.readFile(path.join(gameDir, rel))
    assets[rel] = `data:${mimeOf(rel)};base64,${buf.toString('base64')}`
  }

  const cfg = { ...config, plugins: { ...config.plugins, use: builtinUse } }
  const engineCode = await bundleEngine({ minify, stubToml: true })

  const boot = `<script type="module">
${engineCode}
const { createEngine, applyConfig } = ADV;
const plugins = [];
${pluginChunks.map((c, i) => `${c}\nplugins.push(__nilvnPlugin${i}.default ?? __nilvnPlugin${i});`).join('\n')}
const config = ${JSON.stringify(cfg)};
const assets = ${JSON.stringify(assets)};
const script = ${JSON.stringify(scriptText)};
const catalogs = ${JSON.stringify(catalogs)};
const languages = ${JSON.stringify(languages)};
const defaultLang = ${JSON.stringify(defaultLang)};
const want = new URLSearchParams(location.search).get('lang');
const lang = languages.includes(want) ? want : defaultLang;
const engine = createEngine({ container: document.getElementById('app'), assets, plugins, catalogs, lang, defaultLang, languages });
applyConfig(engine, config);
engine.loadSource(script);
engine.start();
window.engine = engine;
</script>`

  return htmlShell({ title, body: boot })
}

/** Emit a deployable folder: engine.js + index.html + the game files, loaded over http. */
async function buildFolder(gameDir, config, outDir, minify) {
  const title = config.game?.title ?? 'ADV Game'
  await fs.rm(outDir, { recursive: true, force: true })
  await fs.mkdir(outDir, { recursive: true })

  // Copy the whole game folder verbatim (config, script, assets, plugins).
  for (const rel of await walk(gameDir)) {
    const dest = path.join(outDir, rel)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.copyFile(path.join(gameDir, rel), dest)
  }

  const engineCode = await bundleEngine({ minify, stubToml: false })
  await fs.writeFile(path.join(outDir, 'nilvn.js'), engineCode)

  // Optional multi-language content (catalogs.json next to the config): loaded
  // before the engine boots, same as the single-file build inlines it. Without
  // it the game is single-language and @key references have nothing to resolve.
  const hasCatalogs = await fs.access(path.join(gameDir, 'catalogs.json')).then(() => true, () => false)
  const index = htmlShell({
    title,
    head: '<script src="./nilvn.js"></script>',
    body: `<script type="module">
const catalogs = ${hasCatalogs ? "await (await fetch('./catalogs.json')).json()" : '{}'};
const languages = Object.keys(catalogs);
const defaultLang = ${JSON.stringify(config.game?.defaultLang ?? null)} ?? languages[0] ?? 'en';
const want = new URLSearchParams(location.search).get('lang');
const lang = languages.includes(want) ? want : defaultLang;
const engine = ADV.createEngine({ container: document.getElementById('app'), catalogs, lang, defaultLang, ...(languages.length ? { languages } : {}) });
window.engine = engine;
await engine.loadConfig('./nilvn.config.toml');
await engine.start();
</script>`,
  })
  await fs.writeFile(path.join(outDir, 'index.html'), index)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const gameDir = path.resolve(opts.gameDir)
  const configPath = path.join(gameDir, 'nilvn.config.toml')

  let config
  try {
    config = parseToml(await fs.readFile(configPath, 'utf8'))
  } catch {
    throw new Error(`No nilvn.config.toml found in ${gameDir}`)
  }
  const entry = config.game?.entry
  if (!entry) throw new Error('nilvn.config.toml needs [game] entry = "your-script.nvn"')
  const scriptText = await fs.readFile(path.join(gameDir, entry), 'utf8')

  const name = slug(config.game?.title)
  if (opts.dir) {
    const outDir = opts.out ? path.resolve(opts.out) : path.resolve('dist-bundle', name)
    await buildFolder(gameDir, config, outDir, opts.minify)
    console.log(`✓ deployable folder → ${path.relative(process.cwd(), outDir)}/  (serve it over http)`)
  } else {
    const outFile = opts.out ? path.resolve(opts.out) : path.resolve('dist-bundle', `${name}.html`)
    const html = await buildSingleFile(gameDir, config, scriptText, opts.minify)
    await fs.mkdir(path.dirname(outFile), { recursive: true })
    await fs.writeFile(outFile, html)
    const kb = (Buffer.byteLength(html) / 1024).toFixed(0)
    console.log(`✓ single-file game → ${path.relative(process.cwd(), outFile)}  (${kb} kB, double-click to play)`)
  }
}

main().catch((err) => {
  console.error(`[bundle] ${err.message}`)
  process.exit(1)
})
