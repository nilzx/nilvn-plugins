// @vitest-environment jsdom
// The menu plugin's backlog panel, end-to-end against a real engine run:
// played lines appear as rows (speaker + text, ▶ only for voiced lines), the
// wheel-up affordance opens the panel, and Esc closes it before the menu.
import { describe, it, expect, beforeAll } from 'vitest'
import { createEngine, type Engine } from '@nilvn/engine'
import { withFirstParty } from '../src/index'

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} })
})

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 10))

async function playedEngine(): Promise<{ engine: Engine; container: HTMLElement }> {
  const container = document.createElement('div')
  document.body.append(container)
  const engine = createEngine({ ...withFirstParty(), container, use: ['menu'], textSpeed: 0 })
  engine.loadSource('[label start]\nyuki: Hello line one\n[voice v/one.mp3 offset=0.2]\nyuki: A voiced line')
  void engine.start()
  // First line types instantly (textSpeed 0) and parks awaiting a tap.
  for (let i = 0; i < 50 && engine.getBacklog().length < 1; i++) await tick()
  expect(engine.getBacklog().length).toBe(1)
  return { engine, container }
}

describe('menu backlog panel', () => {
  it('wheel-up opens the panel with the played lines; Esc closes it', async () => {
    const { engine, container } = await playedEngine()
    const root = container.querySelector<HTMLElement>('.nilvn-root')!
    const panel = container.querySelector<HTMLElement>('.nilvn-backlog')!
    expect(panel.classList.contains('on')).toBe(false)

    root.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }))
    expect(panel.classList.contains('on')).toBe(true)
    const rows = panel.querySelectorAll('.nilvn-backlog__row')
    expect(rows.length).toBe(1)
    expect(rows[0]!.querySelector('.nilvn-backlog__who')!.textContent).toBe('yuki')
    expect(rows[0]!.querySelector('.nilvn-backlog__text')!.textContent).toBe('Hello line one')
    // The un-voiced line has no replay button.
    expect(rows[0]!.querySelector('.nilvn-backlog__voice')).toBeNull()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(panel.classList.contains('on')).toBe(false)
    engine.destroy()
  })

  it('a voiced line gets a ▶ replay button wired to its ref', async () => {
    const { engine, container } = await playedEngine()
    const root = container.querySelector<HTMLElement>('.nilvn-root')!
    // Advance to the voiced line: tap once (line already fully shown at speed 0).
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    for (let i = 0; i < 50 && engine.getBacklog().length < 2; i++) await tick()
    expect(engine.getBacklog().length).toBe(2)
    expect(engine.getBacklog()[1]).toMatchObject({ speaker: 'yuki', text: 'A voiced line', voiceRef: 'v/one.mp3', offset: 0.2 })

    root.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }))
    const rows = container.querySelectorAll('.nilvn-backlog__row')
    expect(rows.length).toBe(2)
    expect(rows[1]!.querySelector('.nilvn-backlog__voice')).not.toBeNull()
    engine.destroy()
  })

  it('wheel-up while the panel is open leaves it alone (native scroll)', async () => {
    const { engine, container } = await playedEngine()
    const root = container.querySelector<HTMLElement>('.nilvn-root')!
    root.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }))
    const panel = container.querySelector<HTMLElement>('.nilvn-backlog')!
    expect(panel.classList.contains('on')).toBe(true)
    const ev = new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true })
    panel.querySelector('.nilvn-backlog__list')!.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false) // guard let it through for native scrolling
    expect(panel.classList.contains('on')).toBe(true)
    engine.destroy()
  })
})
