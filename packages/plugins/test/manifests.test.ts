import { describe, it, expect } from 'vitest'
import { hasEditorHalf, hasEngineHalf, isPluginId, pluginSlug, resolvePluginId, validatePluginManifest, commandRegistry, BUILTIN_COMMAND_MAP } from '@nilvn/core'
import {
  FIRST_PARTY_IDS,
  allFirstPartyManifests,
  defaultFirstPartyRefs,
  firstPartyCommandMap,
  firstPartyManifest,
  firstPartyManifests,
  isFirstPartyPlugin,
} from '../src/manifests'

// The first-party manifests are the enabled-set source and the command schema
// registry serialize/import round-trip through. A malformed manifest would break
// plugin toggling and command serialization silently.
describe('first-party manifests', () => {
  it('every manifest validates cleanly (no errors, no warnings)', () => {
    for (const m of allFirstPartyManifests) {
      expect(validatePluginManifest(m, { engineVersion: '0.16.0', editorVersion: '0.16.0' }), `manifest "${m.id}"`).toEqual({ errors: [], warnings: [] })
    }
  })

  it('ids are reverse-DNS, unique, in the app.nilvn namespace, and every short name resolves', () => {
    const ids = allFirstPartyManifests.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(isPluginId(id), id).toBe(true)
    for (const [name, id] of Object.entries(FIRST_PARTY_IDS)) {
      expect(resolvePluginId(name)).toBe(id) // core's convention, no table
      expect(resolvePluginId(id)).toBe(id) // idempotent
      expect(pluginSlug(id)).toBe(name)
      expect(firstPartyManifest(name)?.id, name).toBe(id)
    }
    expect(resolvePluginId('com.example.other')).toBe('com.example.other') // an id → verbatim
  })

  it('name / description are i18n ids the manifest messages actually carry', () => {
    for (const m of allFirstPartyManifests) {
      expect(m.name).toBe(`plugin.${pluginSlug(m.id)}.name`)
      expect(m.messages?.en?.[m.name], `${m.id} en name`).toBeTruthy()
      if (m.description) expect(m.messages?.en?.[m.description], `${m.id} en desc`).toBeTruthy()
    }
  })

  it('every manifest names at least one entry half; voicerecord is editor-only', () => {
    for (const m of allFirstPartyManifests) expect(hasEngineHalf(m) || hasEditorHalf(m), m.id).toBe(true)
    const vr = firstPartyManifest('voicerecord')!
    expect(hasEngineHalf(vr)).toBe(false)
    expect(hasEditorHalf(vr)).toBe(true)
  })

  it('defaultFirstPartyRefs enables every content plugin by id', () => {
    const refs = defaultFirstPartyRefs()
    expect(refs.length).toBe(firstPartyManifests.length)
    expect(refs.length).toBeGreaterThan(0)
    for (const r of refs) {
      expect(isPluginId(r.id)).toBe(true)
      expect(isFirstPartyPlugin(r.id)).toBe(true)
      expect('entry' in r).toBe(false)
    }
  })

  it('the in-game menu is no plugin any more (built into the engine since 0.15)', () => {
    expect(firstPartyManifests.some((m) => m.id === 'app.nilvn.menu')).toBe(false)
    expect(isFirstPartyPlugin('menu')).toBe(false)
    expect(isFirstPartyPlugin('definitely-not-a-plugin')).toBe(false)
  })

  it('firstPartyCommandMap carries every plugin command; commandRegistry adds the built-ins', () => {
    const map = firstPartyCommandMap()
    for (const m of firstPartyManifests) for (const c of m.contributes?.commands ?? []) expect(map[c.name], `command "${c.name}" from "${m.id}"`).toBe(c)
    const reg = commandRegistry(firstPartyManifests)
    expect(reg.bg).toBe(BUILTIN_COMMAND_MAP.bg)
    expect(reg.charfx).toBe(map.charfx)
  })
})
