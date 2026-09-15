// @vitest-environment jsdom
// The animstudio runtime half: its commands hand the serializer's wire tokens to
// the stage capability (the engine decodes), its save slice restarts loops from
// their entry pose on load, and a legacy short-name slice still restores.
import { describe, it, expect, beforeAll } from 'vitest'
import { createEngine, decodeChannelSet, decodeFrames, type Engine, type SaveState } from '@nilvn/engine'
import { animstudio } from '../src/index'

beforeAll(() => {
  ;(Element.prototype as unknown as { animate: () => unknown }).animate = () => ({ finished: Promise.resolve(), finish() {} })
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} })
})

const SCRIPT = `[label s1]
yuki: First line
yuki: Second line
`

function freshEngine(): Engine {
  const container = document.createElement('div')
  document.body.append(container)
  const engine = createEngine({ container, textSpeed: 0, plugins: [animstudio] })
  engine.loadSource(SCRIPT)
  return engine
}

const LOOP = { objId: 'camera', duration: 2, entry: decodeChannelSet('scale=1'), body: decodeFrames('0:scale=1;1:scale=1.05;2:scale=1') }

describe('animstudio save slice', () => {
  it('carries running loops under ext[app.nilvn.animstudio]', () => {
    const engine = freshEngine()
    engine.startLoop(LOOP.objId, LOOP.duration, LOOP.entry, LOOP.body, undefined, false)
    const state = engine.saveState()
    expect(state.activeLoops).toBeUndefined()
    expect(state.ext).toEqual({ 'app.nilvn.animstudio': { loops: [expect.objectContaining({ objId: 'camera', duration: 2 })] } })
    engine.destroy()
  })

  it('restores a pre-batch-B slice keyed by the short name (ext.animstudio)', async () => {
    const donor = freshEngine()
    const base = donor.saveState()
    const legacy: SaveState = { ...structuredClone(base), ext: { animstudio: { loops: [structuredClone(LOOP)] } } }
    const engine = freshEngine()
    expect(await engine.restoreState(legacy)).toBe(true)
    expect(engine.runningLoops().map((l) => l.objId)).toEqual(['camera'])
    expect(Object.keys(engine.saveState().ext ?? {})).toEqual(['app.nilvn.animstudio'])
    donor.destroy()
    engine.destroy()
  })

  it('round-trips: a save with a loop restores it running, and re-saves it', async () => {
    const a = freshEngine()
    a.startLoop(LOOP.objId, LOOP.duration, LOOP.entry, LOOP.body, undefined, false)
    const state = a.saveState()
    const b = freshEngine()
    expect(await b.restoreState(structuredClone(state))).toBe(true)
    expect(b.runningLoops().map((l) => l.objId)).toEqual(['camera'])
    expect(b.saveState().ext).toEqual(state.ext)
    a.destroy()
    b.destroy()
  })

  it('still restores the LEGACY top-level activeLoops of a pre-ext save', async () => {
    const donor = freshEngine()
    const base = donor.saveState()
    const legacy: SaveState = { ...structuredClone(base), activeLoops: [structuredClone(LOOP)] }
    const engine = freshEngine()
    expect(await engine.restoreState(legacy)).toBe(true)
    expect(engine.runningLoops().map((l) => l.objId)).toEqual(['camera'])
    donor.destroy()
    engine.destroy()
  })
})

describe('animstudio commands on the wire', () => {
  it('[loopstart] / [loopstop] drive the loop runtime from the serializer tokens', async () => {
    const engine = freshEngine()
    engine.loadSource('[loopstart obj=camera dur=2 entry=scale=1 body=0:scale=1;1:scale=1.05;2:scale=1]\nyuki: hello\n')
    void engine.start()
    await new Promise((r) => setTimeout(r, 30))
    expect(engine.runningLoops().map((l) => l.objId)).toEqual(['camera'])
    engine.destroy()
  })

  it('[eventframe] plays a window track from the wire and settles the end pose', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const engine = createEngine({ container, textSpeed: 0, plugins: [animstudio] })
    engine.loadSource('[eventframe dur=0.2 kf=window:dialog#0:y=0;0.2:y=-141]\n')
    await engine.start()
    expect(engine.stage.getProp('window:dialog', 'y')).toBe(-141)
    expect(engine.stage.snapshot().windows).toEqual([{ id: 'dialog', y: -141 }])
    engine.destroy()
  })
})
