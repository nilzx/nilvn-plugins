// @vitest-environment jsdom
// objectfx's `[layer]`: the three bands the engine offers since 0.17 — `front`
// (over the dialogue box), `back` (behind the characters, still under the
// camera) and `world` (the kind's home band) — reach the renderer through the
// object handle, with anything unknown reading as `front`.
import { describe, it, expect, beforeAll } from 'vitest'
import { createEngine, type Engine } from '@nilvn/engine'
import { objectfx, spriteanim } from '../src/index'

beforeAll(() => {
  ;(Element.prototype as unknown as { animate: () => unknown }).animate = () => ({ finished: Promise.resolve(), finish() {} })
})

const SHEET = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4='

async function play(commands: string): Promise<{ engine: Engine; container: HTMLElement }> {
  const container = document.createElement('div')
  document.body.append(container)
  const engine = createEngine({ container, textSpeed: 0, plugins: [objectfx, spriteanim], screens: { ending: false } })
  engine.loadSource(`[label s1]\n[sprite dust ${SHEET} frames=1 fade=0]\n${commands}\n`)
  await engine.start()
  return { engine, container }
}

function layerOf(container: HTMLElement): string {
  const el = container.querySelector<HTMLElement>('.nilvn-sprite[data-id="dust"]')!
  return el.parentElement!.className
}

describe('[layer] bands', () => {
  it('layer=back tucks a sprite behind the characters, still under the camera', async () => {
    const { engine, container } = await play('[layer target=dust kind=sprite layer=back]')
    expect(layerOf(container)).toContain('nilvn-back')
    expect(engine.stage.getBand('sprite:dust')).toBe('back')
    expect(container.querySelector('.nilvn-back')!.closest('.nilvn-camera')).not.toBeNull()
    engine.destroy()
  })

  it('layer=world returns it to the sprite layer; layer=front lifts it out of the camera', async () => {
    const a = await play('[layer target=dust kind=sprite layer=back]\n[layer target=dust kind=sprite layer=world]')
    expect(layerOf(a.container)).toContain('nilvn-sprites')
    expect(a.engine.stage.getBand('sprite:dust')).toBe('world')
    a.engine.destroy()
    const b = await play('[layer target=dust kind=sprite layer=front]')
    expect(layerOf(b.container)).toContain('nilvn-front')
    expect(b.container.querySelector('.nilvn-front')!.closest('.nilvn-camera')).toBeNull()
    b.engine.destroy()
  })

  it('an unknown layer value reads as front (the command default)', async () => {
    const { engine, container } = await play('[layer target=dust kind=sprite layer=sideways]')
    expect(layerOf(container)).toContain('nilvn-front')
    engine.destroy()
  })
})
