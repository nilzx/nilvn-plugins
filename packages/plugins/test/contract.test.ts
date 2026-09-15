// @vitest-environment jsdom
// The first-party plugins' own contract: every runtime module has a manifest and
// vice versa, each declares the same engine-side permissions and object kinds
// its manifest does, every command a manifest advertises is one the runtime
// registers, and the id namespace is the one core / engine reserve. (Moved from
// the engine's core-contract test when the plugins left the engine package.)
import { describe, it, expect } from 'vitest'
import { FIRST_PARTY_ID_PREFIX as CORE_PREFIX, PERMISSIONS, hasEngineHalf } from '@nilvn/core'
import { ENGINE_CAPABILITIES, FIRST_PARTY_ID_PREFIX as ENGINE_PREFIX, createEngine, builtins } from '@nilvn/engine'
import { FIRST_PARTY_IDS, allFirstPartyManifests, firstPartyManifests, firstPartyPlugins, menuManifest, withFirstParty } from '../src/index'

describe('manifest ↔ runtime module', () => {
  it('every id lives in the namespace core and the engine reserve', () => {
    expect(CORE_PREFIX).toBe(ENGINE_PREFIX)
    for (const id of Object.values(FIRST_PARTY_IDS)) expect(id.startsWith(CORE_PREFIX), id).toBe(true)
    for (const p of firstPartyPlugins) expect(p.id.startsWith(CORE_PREFIX), p.id).toBe(true)
  })

  it('every manifest with an engine half has a runtime module, and vice versa', () => {
    const manifests = new Set(allFirstPartyManifests.filter(hasEngineHalf).map((m) => m.id))
    const runtime = new Set(firstPartyPlugins.map((p) => p.id))
    expect([...manifests].filter((n) => !runtime.has(n))).toEqual([])
    expect([...runtime].filter((n) => !manifests.has(n))).toEqual([])
    expect(runtime.has(FIRST_PARTY_IDS.menu)).toBe(true)
  })

  it('every runtime module declares exactly the engine-side permissions its manifest does', () => {
    const engineSide = (ids: readonly string[]): string[] => ids.filter((id) => PERMISSIONS.find((p) => p.id === id)?.side === 'engine').sort()
    for (const m of allFirstPartyManifests) {
      const p = firstPartyPlugins.find((x) => x.id === m.id)
      if (!p) continue
      expect(engineSide(p.permissions ?? []), m.id).toEqual(engineSide(m.permissions ?? []))
      for (const perm of engineSide(p.permissions ?? [])) expect(ENGINE_CAPABILITIES, `${m.id}: ${perm}`).toContain(perm)
    }
  })

  it('plugin-contributed kinds match between manifest and runtime', () => {
    for (const m of firstPartyManifests) {
      const p = firstPartyPlugins.find((x) => x.id === m.id)
      if (!p) continue
      expect((p.objectKinds ?? []).map((k) => k.id).sort()).toEqual((m.contributes?.objectKinds ?? []).map((k) => k.id).sort())
    }
  })

  it('every command a manifest advertises is registered by its runtime module, and none collides with a builtin', () => {
    for (const m of firstPartyManifests) {
      const p = firstPartyPlugins.find((x) => x.id === m.id)
      if (!p) continue
      for (const c of m.contributes?.commands ?? []) {
        expect(Object.keys(p.commands ?? {}), `${m.id}: ${c.name}`).toContain(c.name)
        expect(c.name in builtins, `${c.name} shadows a builtin`).toBe(false)
      }
    }
  })

  it('withFirstParty() registers every module with its manifest attached; the set boots and activates by short name', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const e = createEngine({ ...withFirstParty(), container, textSpeed: 0 })
    e.loadSource('[use textfx screenfx menu]\n[set x = 1]')
    await e.start()
    expect(e.activePlugins).toEqual([FIRST_PARTY_IDS.textfx, FIRST_PARTY_IDS.screenfx, FIRST_PARTY_IDS.menu])
    expect(e.getTextEffect('wave')).toBeTypeOf('function')
    expect(e.diagnostics).toEqual([])
    expect(menuManifest.permissions).toEqual(firstPartyPlugins.find((p) => p.id === FIRST_PARTY_IDS.menu)!.permissions)
    e.destroy()
  })
})
