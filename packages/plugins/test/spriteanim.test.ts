// @vitest-environment jsdom
// `[sprite … if=]`: spriteanim declares `ifFalse: 'handle'` and hands the condition
// to the stage with the sprite, as `[hotspot … if=]` does: the engine re-evaluates
// it on every variable change, so a one-shot clickable sprite turns off after its
// own click, and comes back when the variable does.
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

const el = (e: Engine, id: string): HTMLElement | null => e.stage.root.querySelector<HTMLElement>(`.nilvn-sprite[data-id="${id}"]`)
const on = (e: Engine, id: string): boolean => !!el(e, id) && !el(e, id)!.hidden
const tick = (ms = 10): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('[sprite if=]', () => {
  it('shows the sprite while the condition holds', async () => {
    const e = await play(`[set seen = false]\n[sprite star ${SHEET} onclick="set seen = true" fade=0 if=!seen]`)
    expect(on(e, 'star')).toBe(true)
    expect(e.stage.snapshot().sprites?.[0]?.if).toBe('!seen')
    expect(e.diagnostics).toEqual([])
    e.destroy()
  })

  it('turns off after its own one-shot click, and on again when the variable changes back', async () => {
    const e = await play(`[set clicks = 0]\n[sprite star ${SHEET} onclick="set clicks = clicks + 1" fade=0 if=clicks == 0]`)
    el(e, 'star')!.click()
    await tick(20)
    expect(e.getVar('clicks')).toBe(1)
    expect(on(e, 'star')).toBe(false)
    el(e, 'star')!.click()
    await tick(20)
    expect(e.getVar('clicks')).toBe(1) // an off sprite takes no click
    e.setVar('clicks', 0)
    expect(on(e, 'star')).toBe(true)
    expect(e.diagnostics).toEqual([])
    e.destroy()
  })

  it('is off when false from the start', async () => {
    const e = await play(`[set seen = true]\n[sprite star ${SHEET} fade=0 if=!seen]`)
    expect(on(e, 'star')).toBe(false)
    e.destroy()
  })
})
