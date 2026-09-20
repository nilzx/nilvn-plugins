// @vitest-environment jsdom
// Smoke-tests the SHIPPED batteries-included artifact (`@nilvn/plugins/iife`,
// dist/nilvn.iife.js — the bundle exports inline and the desktop player runs):
// builds it through the shared builder (scripts/build-iife.ts) and boots a real
// engine from the minified bytes with a first-party plugin in play. Unit tests
// import the TS source; only this file exercises the bundle form — minification,
// the smol-toml stub, the ADV global, the pre-registered plugin set.
//
// Also pins the erasure rule for this package: the plugin modules import
// @nilvn/engine / @nilvn/core TYPE-ONLY (scripts/check-boundary.mjs), and the
// bundle carries the engine exactly once and no core runtime.
import { beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUILDER = join(HERE, '..', 'scripts', 'build-iife.ts')

interface AdvGlobal {
  createEngine(opts: { container: HTMLElement; textSpeed?: number }): {
    loadSource(src: string): void
    start(label?: string): Promise<void>
    destroy(): void
    readonly activePlugins: readonly string[]
    readonly diagnostics: readonly { message: string }[]
  }
  parseScript(src: string): unknown
  WebContentLoader: unknown
  firstPartyPlugins: readonly { id: string }[]
}

let code = ''
beforeAll(() => {
  const dest = join(tmpdir(), `nilvn-plugins-iife-smoke-${process.pid}.js`)
  try {
    execFileSync(process.execPath, ['--experimental-strip-types', BUILDER, dest], { stdio: 'pipe' })
    code = readFileSync(dest, 'utf8')
  } finally {
    rmSync(dest, { force: true })
  }
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} })
}, 30_000)

function evalBundle(): AdvGlobal {
  return new Function(`${code}; return ADV`)() as AdvGlobal
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 10))
const until = async (cond: () => boolean): Promise<void> => {
  for (let i = 0; i < 100 && !cond(); i++) await tick()
  expect(cond()).toBe(true)
}

describe('batteries-included IIFE artifact', () => {
  it('builds to a sane self-contained bundle exposing the engine surface plus the plugin set', () => {
    expect(code.length).toBeGreaterThan(40_000)
    expect(code.length).toBeLessThan(1_500_000)
    const ADV = evalBundle()
    expect(typeof ADV.createEngine).toBe('function')
    expect(typeof ADV.parseScript).toBe('function')
    expect(typeof ADV.WebContentLoader).toBe('function')
    expect(ADV.firstPartyPlugins.map((p) => p.id)).not.toContain('app.nilvn.menu') // the menu is the engine's own
  })

  it('boots, activates a first-party plugin by short name and renders its effect from the minified bytes', async () => {
    const ADV = evalBundle()
    const container = document.createElement('div')
    document.body.append(container)
    const engine = ADV.createEngine({ container, textSpeed: 0 })
    engine.loadSource('[use textfx]\n[label s1]\nyuki: {wave:Hello} from the bundle\n')
    void engine.start()
    await until(() => (container.textContent ?? '').includes('Hello from the bundle'))
    expect(engine.activePlugins).toEqual(['app.nilvn.textfx'])
    expect(container.querySelectorAll('.tfx-wave').length).toBe(5)
    expect(engine.diagnostics).toEqual([])
    engine.destroy()
    container.remove()
  })

  it('carries the engine once and no core runtime', () => {
    expect(code).not.toContain('__nilvn_unset__') // core serialize.ts
    expect(code).not.toContain('validatePluginManifest') // core plugin-manifest.ts
    expect(code.split('nilvn-root').length - 1).toBeGreaterThan(0)
    // The engine's plugin host is bundled exactly once (its style-id prefix is a
    // single literal in the engine source).
    expect(code.split('nilvn-plugin-').length - 1).toBe(1)
  })
})
