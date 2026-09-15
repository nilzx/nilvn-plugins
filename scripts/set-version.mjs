#!/usr/bin/env node
// Set the plugins-axis version. Usage: pnpm version:set plugins <x.y.z>
//
// @nilvn/plugins has its own version axis: it declares an engine RANGE in each
// manifest (`engine: ">=0.14 <1"`) and in package.json's peerDependencies, and
// releases on its own cadence (`plugins-v*` tags → npm). Does NOT tag — it
// prints the suggested commit + tag command.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FILES = ['packages/plugins/package.json']
const TAG_PREFIX = 'plugins-v'

const [component, version] = process.argv.slice(2)
if (component !== 'plugins') {
  console.error('Usage: pnpm version:set plugins <x.y.z>   (e.g. pnpm version:set plugins 0.2.0)')
  process.exit(1)
}
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Version must be SemVer x.y.z (e.g. 0.2.0).')
  process.exit(1)
}

const at = (rel) => fileURLToPath(new URL('../' + rel, import.meta.url))
for (const rel of FILES) {
  const src = readFileSync(at(rel), 'utf8')
  const next = src.replace(/("version":\s*)"[^"]*"/, `$1"${version}"`)
  if (next === src) {
    console.error(`  ${rel}: version line not found`)
    process.exit(1)
  }
  writeFileSync(at(rel), next)
  console.log(`  ${rel} → ${version}`)
}
const tag = `${TAG_PREFIX}${version}`
console.log(`\n✓ plugins set to ${version}.`)
console.log(`Next:  git commit -am "chore(release): plugins v${version}" && git tag -a ${tag} -m "plugins v${version} — ..."`)
