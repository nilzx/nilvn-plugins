// @vitest-environment jsdom
// A–B replay runtime: [replaydef] registers at parse time, [replayend] fires the
// unlock signal in normal play, playReplay runs a clean-slate session from the
// start label and hands control back at the end marker.
import { describe, it, expect, beforeAll } from 'vitest'
import { createEngine, type Engine } from '@nilvn/engine'
import { abreplay } from '../src/index'

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} })
})

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 10))
const until = async (cond: () => boolean): Promise<void> => {
  for (let i = 0; i < 100 && !cond(); i++) await tick()
  expect(cond()).toBe(true)
}

const SCRIPT = `[replaydef id=r1 title=相遇 label=__replay_r1]
[label s1]
[set met = 1]
[label __replay_r1]
yuki: First line
yuki: Second line
[replayend r1]
yuki: After the segment
`

function freshEngine(): { engine: Engine; root: () => HTMLElement } {
  const container = document.createElement('div')
  document.body.append(container)
  // The replay commands live in the abreplay plugin now; install it at
  // construction so the parse-time scan sees its handlers (the editor/exports
  // pass it via `use`, which start() covers with a re-scan).
  const engine = createEngine({ container, textSpeed: 0, plugins: [abreplay] })
  engine.loadSource(SCRIPT)
  return { engine, root: () => container.querySelector<HTMLElement>('.nilvn-root')! }
}

describe('A–B replay runtime', () => {
  it('registers [replaydef] at parse time, before any execution', () => {
    const { engine } = freshEngine()
    expect(engine.replays).toEqual([{ id: 'r1', title: '相遇', label: '__replay_r1' }])
    expect(engine.isReplaying()).toBeNull()
  })

  it('with the plugin via [use]-style autoload, start() picks the segments up', async () => {
    // loadSource runs before use-plugins install (the editor/export path), so the
    // parse-time scan finds no handler; the re-scan after plugin resolution must.
    const container = document.createElement('div')
    document.body.append(container)
    const engine = createEngine({ container, textSpeed: 0, registry: [abreplay], use: ['abreplay'] })
    engine.loadSource(SCRIPT)
    expect(engine.replays).toEqual([]) // not yet — plugin not installed
    void engine.start()
    await until(() => engine.replays.length === 1)
    expect(engine.replays[0]!.id).toBe('r1')
    engine.destroy()
  })

  it('without the plugin, segments register nowhere and markers are inert', async () => {
    // Disabled degradation: the gallery must not list segments whose unlock can
    // never fire, and the emitted markers must fall through as unknown-command
    // no-ops rather than crash the story.
    const container = document.createElement('div')
    document.body.append(container)
    const engine = createEngine({ container, textSpeed: 0 })
    engine.loadSource(SCRIPT)
    const seen: string[] = []
    engine.onSegmentSeen((id) => seen.push(id))
    void engine.start()
    await until(() => engine.getBacklog().length === 1)
    const root = container.querySelector<HTMLElement>('.nilvn-root')!
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await until(() => engine.getBacklog().length === 2)
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await until(() => engine.getBacklog().length === 3) // sailed past [replayend]
    expect(engine.replays).toEqual([])
    expect(seen).toEqual([])
    engine.destroy()
  })

  it('normal play fires the unlock signal when passing the end marker', async () => {
    const { engine, root } = freshEngine()
    const seen: string[] = []
    engine.onSegmentSeen((id) => seen.push(id))
    void engine.start()
    await until(() => engine.getBacklog().length === 1)
    expect(seen).toEqual([]) // mid-segment: not yet
    root().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await until(() => engine.getBacklog().length === 2)
    root().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await until(() => seen.length === 1) // passed [replayend r1]
    expect(seen).toEqual(['r1'])
    engine.destroy()
  })

  it('playReplay runs clean-slate from the start label and ends at the marker', async () => {
    const { engine, root } = freshEngine()
    void engine.start()
    await until(() => engine.getBacklog().length === 1)
    engine.vars.somevar = 42
    let ended = 0
    engine.onReplayEnd = () => {
      ended++
    }
    const ok = await engine.playReplay('r1')
    expect(ok).toBe(true)
    expect(engine.isReplaying()).toBe('r1')
    expect(engine.vars.somevar).toBeUndefined() // clean slate
    expect(engine.vars.met).toBeUndefined() // started AT the label, after [set met]
    await until(() => engine.getBacklog().length === 1) // replay replays line 1
    root().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await until(() => engine.getBacklog().length === 2)
    root().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await until(() => ended === 1) // [replayend r1] handed control back
    expect(engine.isReplaying()).toBeNull()
    engine.destroy()
  })

  it('passing the marker DURING its own replay does not fire the unlock signal', async () => {
    const { engine, root } = freshEngine()
    const seen: string[] = []
    engine.onSegmentSeen((id) => seen.push(id))
    let ended = false
    engine.onReplayEnd = () => {
      ended = true
    }
    await engine.playReplay('r1')
    await until(() => engine.getBacklog().length === 1)
    root().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await until(() => engine.getBacklog().length === 2)
    root().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await until(() => ended)
    expect(seen).toEqual([])
    engine.destroy()
  })

  it('playReplay rejects an unknown segment id', async () => {
    const { engine } = freshEngine()
    expect(await engine.playReplay('nope')).toBe(false)
    expect(engine.isReplaying()).toBeNull()
  })
})
