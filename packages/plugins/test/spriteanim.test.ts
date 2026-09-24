// @vitest-environment jsdom
// `[sprite … if=]`: spriteanim declares `ifFalse: 'handle'`, so a false condition
// still reaches the command and takes the sprite off the stage — the same "not
// present" meaning `[hotspot … if=]` has. A scene that re-runs after the click
// therefore retires a one-shot clickable sprite instead of leaving it clickable.
import { describe, it, expect, beforeAll } from 'vitest'
import { createEngine, type Engine } from '@nilvn/engine'
import { withFirstParty } from '../src/index'

beforeAll(() => {
  ;(Element.prototype as unknown as { animate: () => unknown }).animate = () => ({ finished: Promise.resolve(), finish() {} })
})

const SHEET = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4='

async function play(script: string): Promise<Engine> {
  const container = document.createElement('div')
  document.body.append(container)
  const engine = createEngine({ container, textSpeed: 0, ...withFirstParty(), use: ['spriteanim'], screens: { ending: false } })
  engine.loadSource(`[label s1]\n${script}\n`)
  await engine.start()
  return engine
}

const sprites = (e: Engine): string[] => (e.stage.snapshot().sprites ?? []).map((s) => s.id)

describe('[sprite if=]', () => {
  it('shows the sprite while the condition holds', async () => {
    const e = await play(`[set seen = false]\n[sprite star ${SHEET} onclick="set seen = true" fade=0 if=!seen]`)
    expect(sprites(e)).toEqual(['star'])
    expect(e.diagnostics).toEqual([])
    e.destroy()
  })

  it('takes an on-stage sprite away when the condition turns false', async () => {
    const tag = `[sprite star ${SHEET} onclick="set seen = true" fade=0 if=!seen]`
    const e = await play(`[set seen = false]\n${tag}\n[set seen = true]\n${tag}`)
    expect(sprites(e)).toEqual([])
    expect(e.diagnostics).toEqual([])
    e.destroy()
  })

  it('never shows it when false from the start', async () => {
    const e = await play(`[set seen = true]\n[sprite star ${SHEET} fade=0 if=!seen]`)
    expect(sprites(e)).toEqual([])
    e.destroy()
  })
})
