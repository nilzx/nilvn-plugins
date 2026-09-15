// @vitest-environment jsdom
// The menu plugin's 10×10 save-slot screen: legacy single-slot migration, page
// tabs, saving into a slot (with metadata + overwrite confirm), and loading back.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { createEngine, type Engine } from '@nilvn/engine'
import { withFirstParty } from '../src/index'

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} })
  // Neither Node's experimental localStorage (needs --localstorage-file) nor this
  // jsdom setup provides a working Storage — install an in-memory one for the menu.
  const store = new Map<string, string>()
  const stub = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: stub })
})
beforeEach(() => {
  localStorage.clear()
  document.body.replaceChildren()
})

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 10))
const until = async (cond: () => boolean): Promise<void> => {
  for (let i = 0; i < 100 && !cond(); i++) await tick()
  expect(cond()).toBe(true)
}

// jsdom has an empty document.title → the per-game id falls back to 'game'.
const LEGACY_KEY = 'nilvn:save:game'
const slotKey = (i: number): string => `nilvn:save:game:${i}`

async function playedEngine(): Promise<{ engine: Engine; container: HTMLElement }> {
  const container = document.createElement('div')
  document.body.append(container)
  const engine = createEngine({ ...withFirstParty(), container, use: ['menu'], textSpeed: 0 })
  engine.loadSource('[label start]\nyuki: Hello line one\nyuki: Second line')
  void engine.start()
  await until(() => engine.getBacklog().length === 1)
  return { engine, container }
}

function menuItem(container: HTMLElement, index: number): HTMLButtonElement {
  return container.querySelectorAll<HTMLButtonElement>('.nilvn-menu__item')[index]!
}
const SAVE = 0
const LOAD = 1

describe('menu save slots (10 pages × 10)', () => {
  it('migrates the legacy single-slot save into slot 0', async () => {
    localStorage.setItem(LEGACY_KEY, '{"v":2,"legacy":true}')
    const { engine, container } = await playedEngine()
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
    expect(localStorage.getItem(slotKey(0))).toBe('{"v":2,"legacy":true}')
    // The load screen shows it as an occupied slot (bare legacy shape accepted).
    menuItem(container, LOAD).click()
    const cells = container.querySelectorAll('.nilvn-saves__slot')
    expect(cells.length).toBe(10)
    expect(cells[0]!.classList.contains('has-data')).toBe(true)
    expect(cells[1]!.classList.contains('has-data')).toBe(false)
    engine.destroy()
  })

  it('saving into a slot writes metadata + state; overwrite asks first', async () => {
    const { engine, container } = await playedEngine()
    menuItem(container, SAVE).click()
    expect(container.querySelector('.nilvn-saves')!.classList.contains('on')).toBe(true)
    container.querySelectorAll<HTMLButtonElement>('.nilvn-saves__slot')[2]!.click()
    const raw = localStorage.getItem(slotKey(2))
    expect(raw).toBeTruthy()
    const payload = JSON.parse(raw!) as { v: number; savedAt: number; preview: string; state: { v: number } }
    expect(payload.v).toBe(1)
    expect(payload.preview).toContain('Hello line one')
    expect(payload.state.v).toBe(2)
    // Overwrite: declined → untouched; accepted → re-written.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    container.querySelectorAll<HTMLButtonElement>('.nilvn-saves__slot')[2]!.click()
    expect(localStorage.getItem(slotKey(2))).toBe(raw)
    confirmSpy.mockReturnValue(true)
    await tick()
    container.querySelectorAll<HTMLButtonElement>('.nilvn-saves__slot')[2]!.click()
    expect(confirmSpy).toHaveBeenCalled()
    confirmSpy.mockRestore()
    engine.destroy()
  })

  it('page tabs address later slots (page 2 slot 1 = slot 10)', async () => {
    const { engine, container } = await playedEngine()
    menuItem(container, SAVE).click()
    container.querySelectorAll<HTMLButtonElement>('.nilvn-saves__page')[1]!.click()
    const first = container.querySelector<HTMLButtonElement>('.nilvn-saves__slot')!
    expect(first.querySelector('.nilvn-saves__no')!.textContent).toBe('2-1')
    first.click()
    expect(localStorage.getItem(slotKey(10))).toBeTruthy()
    expect(localStorage.getItem(slotKey(0))).toBeNull()
    engine.destroy()
  })

  it('loading an occupied slot restores that session', async () => {
    const { engine, container } = await playedEngine()
    menuItem(container, SAVE).click()
    container.querySelectorAll<HTMLButtonElement>('.nilvn-saves__slot')[0]!.click()
    container.querySelector<HTMLButtonElement>('.nilvn-backlog__close')!.click()
    engine.vars.progress = 'later'
    menuItem(container, LOAD).click()
    container.querySelectorAll<HTMLButtonElement>('.nilvn-saves__slot')[0]!.click()
    await until(() => engine.vars.progress === undefined) // restored pre-save vars
    // The screen closes once the whole restore settles (vars reset earlier, mid-restore).
    await until(() => !container.querySelector('.nilvn-saves')!.classList.contains('on'))
    engine.destroy()
  })

  it('clicking an empty slot in load mode is inert', async () => {
    const { engine, container } = await playedEngine()
    menuItem(container, LOAD).click()
    container.querySelectorAll<HTMLButtonElement>('.nilvn-saves__slot')[5]!.click()
    await tick()
    expect(container.querySelector('.nilvn-saves')!.classList.contains('on')).toBe(true) // still open
    expect(engine.getBacklog().length).toBe(1) // session untouched
    engine.destroy()
  })
})
