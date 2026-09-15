// @vitest-environment jsdom
// The menu shell: releases every window listener on destroy (with voicefx in
// play too), and two engines on one page label their menus in their own work
// language through the plugin's manifest messages.
import { describe, it, expect, beforeAll } from 'vitest'
import { createEngine, type Engine } from '@nilvn/engine'
import { menuManifest, withFirstParty } from '../src/index'

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} })
})

function watchWindowListeners(): () => { leaked: string[] } {
  const live = new Map<object, string>()
  const add = window.addEventListener.bind(window)
  const remove = window.removeEventListener.bind(window)
  window.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: unknown) => {
    live.set(fn, type)
    add(type, fn, opts as AddEventListenerOptions)
  }) as typeof window.addEventListener
  window.removeEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: unknown) => {
    live.delete(fn)
    remove(type, fn, opts as EventListenerOptions)
  }) as typeof window.removeEventListener
  return () => {
    window.addEventListener = add
    window.removeEventListener = remove
    return { leaked: [...live.values()] }
  }
}

function engineWith(use: string[], lang?: string): Engine {
  const container = document.createElement('div')
  document.body.append(container)
  return createEngine({ ...withFirstParty(), container, use, textSpeed: 0, ...(lang ? { lang, defaultLang: lang, languages: [lang] } : {}) })
}

describe('menu shell', () => {
  it('leaves no window listener behind after a run with the menu + voicefx plugins', async () => {
    const done = watchWindowListeners()
    const e = engineWith(['menu', 'voicefx'])
    e.loadSource('[label s1]\n[bgm music.mp3]\n[se ding.mp3]\nyuki: Hello\n')
    void e.start()
    for (let i = 0; i < 50 && !e.stage.textEl.textContent; i++) await new Promise((r) => setTimeout(r, 5))
    e.destroy()
    const { leaked } = done()
    expect(leaked).toEqual([])
  })

  it('two engines with different work languages label their menus independently', async () => {
    const zh = engineWith(['menu'], 'zh')
    const en = engineWith(['menu'], 'en')
    zh.loadSource('yuki: a')
    en.loadSource('yuki: a')
    await zh.usePlugins(['menu'])
    await en.usePlugins(['menu'])
    const label = (e: Engine): string => e.stage.root.querySelectorAll<HTMLElement>('.nilvn-menu__item')[1]!.textContent ?? ''
    expect(label(zh)).toBe(menuManifest.messages!.zh!['plugin.menu.load'])
    expect(label(en)).toBe(menuManifest.messages!.en!['plugin.menu.load'])
    expect(label(zh)).not.toBe(label(en))
    zh.destroy()
    en.destroy()
  })
})
