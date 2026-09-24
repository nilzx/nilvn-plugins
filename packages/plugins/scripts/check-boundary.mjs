#!/usr/bin/env node
// The plugin boundary, enforced: every first-party runtime module under
// src/plugins/ is written exactly like a third-party plugin — against the
// PUBLIC types of @nilvn/engine / @nilvn/core (type-only imports, erased at
// build) and the capability objects on `ctx.plugin`. Anything else is a hole in
// the SDK, to be closed in the engine (a capability, a context accessor, a
// declarable form), never by reaching into engine internals:
//   - no relative import that leaves src/plugins/ (../engine, ../keyframes …);
//   - no VALUE import from @nilvn/engine or @nilvn/core (their runtime is the
//     host's — bundling a second copy would duplicate engine state);
//   - no import from @nilvn/plugin-sdk either: it is a build-time toolkit.
// And one style rule: a plugin's `styles` take every colour from the theme
// (`var(--nilvn-*)`, docs/PLUGINS.md) — no hex / rgb() / hsl() / named colour
// literals, so a work's [theme] recolours plugin chrome with everything else.
// Exit 1 with the offending lines; `pnpm typecheck` runs it.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, '..', 'src', 'plugins')
const problems = []
for (const name of readdirSync(dir)) {
  if (!name.endsWith('.ts')) continue
  const file = join(dir, name)
  const src = readFileSync(file, 'utf8')
  for (const stmt of src.match(/^(?:import|export)\b[\s\S]*?from\s*['"][^'"]+['"]/gm) ?? []) {
    const spec = stmt.match(/from\s*['"]([^'"]+)['"]/)[1]
    const typeOnly = /^(?:import|export)\s+type\b/.test(stmt)
    const rel = relative(dir, file)
    if (spec.startsWith('.')) {
      if (spec.startsWith('..')) problems.push(`${rel}: relative import leaves src/plugins: ${spec}`)
      continue
    }
    if (/^@nilvn\/(engine|core)$/.test(spec)) {
      if (!typeOnly) problems.push(`${rel}: value import from ${spec} (types only — reach the runtime through ctx.plugin)`)
      continue
    }
    problems.push(`${rel}: import from ${spec} (a plugin module bundles no dependencies)`)
  }
  for (const stmt of src.match(/^import\s*['"][^'"]+['"]/gm) ?? []) problems.push(`${relative(dir, file)}: side-effect import ${stmt}`)
  for (const m of src.matchAll(/\bstyles:\s*`([\s\S]*?)`/g)) {
    for (const lit of colourLiterals(m[1])) problems.push(`${relative(dir, file)}: colour literal "${lit}" in styles (use a --nilvn-* theme token)`)
  }
}
/** Colour literals in a stylesheet's declaration values. `transparent` /
 *  `currentColor` / `inherit` are not colours of their own and pass. */
function colourLiterals(css) {
  const out = []
  const FUNCS = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i
  const HEX = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i
  const NAMED = /\b(?:white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|maroon|navy|teal|olive|lime|aqua|fuchsia|cyan|magenta|gold)\b/i
  for (const [, value] of css.matchAll(/[a-z-]+\s*:\s*([^;{}]+)/gi)) {
    const bare = value.replace(/var\([^()]*\)/g, '') // a token's name is not a colour
    const hit = bare.match(FUNCS) ?? bare.match(HEX) ?? bare.match(NAMED)
    if (hit) out.push(value.trim())
  }
  return out
}

if (problems.length) {
  console.error('✗ plugin boundary violated:')
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}
console.log(`✓ plugin boundary holds (${readdirSync(dir).filter((n) => n.endsWith('.ts')).length} modules)`)
