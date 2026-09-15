import type { EnginePlugin, PluginContext, SavesCap, SaveState, VolumeChannel } from '@nilvn/engine'

// In-game menu for the exported/standalone game: save & resume progress (to
// localStorage), adjust text speed, set per-channel volume (music / sfx / voice),
// and — when the work ships more than one language — switch language live. Pure
// DOM inside host-provided layers + the session capabilities (`session.save` /
// `session.settings` / `session.backlog` / `session.replay`), `ui.layer` and
// `timer` — no script authoring needed; export enables it by default. (The
// editor's own preview omits it; it's meant for the finished game.) The hardest
// plugin on the capability model: it never sees the engine.
//
// All chrome text goes through ctx.t, resolved from this plugin's own manifest
// `messages` (plugin.menu.*); applyLang() re-localizes everything when the
// player switches language.

// Text-speed presets. `label` is a plugin.menu.* message id (resolved in setup, not here).
const SPEEDS: { label: string; cps: number }[] = [
  { label: 'plugin.menu.speed.slow', cps: 20 },
  { label: 'plugin.menu.speed.normal', cps: 40 },
  { label: 'plugin.menu.speed.fast', cps: 80 },
]

// The four master-volume channels exposed in the menu (the settings capability's
// channel names). `label` is a message id; `store` is the persisted settings field
// (the pre-batch-B engine field name, kept so saved settings keep loading).
const CHANNELS: { label: string; key: VolumeChannel; store: string }[] = [
  { label: 'plugin.menu.vol.music', key: 'bgm', store: 'bgmVolume' },
  { label: 'plugin.menu.vol.ambience', key: 'ambience', store: 'ambienceVolume' },
  { label: 'plugin.menu.vol.sfx', key: 'se', store: 'seVolume' },
  { label: 'plugin.menu.vol.voice', key: 'voice', store: 'voiceVolume' },
]

// Per-game id so two exported games (which often share a title) don't clobber
// each other's save / settings: the loaded package's `saveKey` (nilvn.json), else
// the document title. Read per call so a package loaded after install wins.
function gameId(saves: SavesCap): string {
  return saves.saveKey || (typeof document !== 'undefined' ? document.title || 'game' : 'game')
}
function saveKey(saves: SavesCap): string {
  return 'nilvn:save:' + gameId(saves)
}
/** Per-slot save key. 10 pages × 10 slots = 100 slots (0..99), VN-style. The
 *  legacy single-slot key (no suffix) is migrated into slot 0 on activate. */
function slotKey(saves: SavesCap, slot: number): string {
  return `${saveKey(saves)}:${slot}`
}
const SAVE_PAGES = 10
const SLOTS_PER_PAGE = 10

/** A stored slot: the engine SaveState wrapped with display metadata. A legacy
 *  slot (migrated from the single-slot era) is a bare SaveState — `readSlot`
 *  accepts both shapes. */
interface SlotPayload {
  v: 1
  savedAt: number
  preview: string
  state: unknown
}
function settingsKey(saves: SavesCap): string {
  return 'nilvn:settings:' + gameId(saves)
}
/** Per-game unlocked replay-segment ids — independent of any save
 *  slot: once seen through in normal play, a segment stays unlocked for good. */
function unlocksKey(saves: SavesCap): string {
  return 'nilvn:unlocks:' + gameId(saves)
}

// Studio version that produced this build (the package's `engine`). Shown in the
// menu so a build is traceable to a tool version.
function studioVersion(saves: SavesCap): string {
  return saves.buildInfo || ''
}

/** The capability set the menu cannot run without, typed non-optional past the check. */
function requireCaps(ctx: PluginContext): Required<Pick<PluginContext, 'saves' | 'settings' | 'backlog' | 'replay' | 'ui' | 'timer'>> | null {
  const { saves, settings, backlog, replay, ui, timer } = ctx
  if (!saves || !settings || !backlog || !replay || !ui || !timer) return null
  return { saves, settings, backlog, replay, ui, timer }
}

export const menu: EnginePlugin = {
  id: 'app.nilvn.menu',
  permissions: ['session.save', 'session.settings', 'session.backlog', 'session.replay', 'ui.layer', 'timer'],
  styles: `
.nilvn-menu{position:absolute;top:1.6cqh;right:1.6cqw;z-index:50;font-size:2.6cqh}
.nilvn-menu__btn{width:5cqh;height:5cqh;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(12,14,22,.6);border:1px solid rgba(255,255,255,.2);color:#fff;cursor:pointer;backdrop-filter:blur(4px);line-height:1}
.nilvn-menu__btn:hover{background:rgba(30,34,54,.85)}
.nilvn-menu__panel{position:absolute;top:6cqh;right:0;width:30cqw;display:none;flex-direction:column;gap:1.2cqh;padding:2cqh;border-radius:1.4cqh;background:rgba(16,18,28,.96);border:1px solid rgba(255,255,255,.16);box-shadow:0 1.2cqh 4cqh rgba(0,0,0,.5)}
.nilvn-menu.on .nilvn-menu__panel{display:flex}
.nilvn-menu__item{padding:1.2cqh 1.6cqw;border-radius:.9cqh;background:rgba(40,46,74,.6);border:1px solid rgba(255,255,255,.14);color:#fff;font:inherit;font-size:2.4cqh;cursor:pointer;text-align:center}
.nilvn-menu__item:hover{background:rgba(60,68,110,.8)}
.nilvn-menu__item:disabled{opacity:.45;cursor:default}
.nilvn-menu__grid{display:grid;grid-template-columns:minmax(0,max-content) minmax(6cqw,1fr) max-content;align-items:center;gap:1.2cqh 1cqw;font-size:2.1cqh;color:#cdd2e6}
.nilvn-menu__row{display:contents}
.nilvn-menu__row>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nilvn-menu__seg{grid-column:2/-1;display:flex;gap:.8cqw}
.nilvn-menu__seg button{flex:1;padding:.8cqh 0;border-radius:.8cqh;background:rgba(40,46,74,.6);border:1px solid rgba(255,255,255,.14);color:#fff;font:inherit;font-size:2.1cqh;cursor:pointer}
.nilvn-menu__seg button.on{background:#ff5d9e;border-color:#ff5d9e}
.nilvn-menu__vol{flex:1;min-width:0;accent-color:#ff5d9e;cursor:pointer}
.nilvn-menu__pct{width:7cqw;text-align:right;font-size:1.9cqh;color:#9aa3c0;font-variant-numeric:tabular-nums}
.nilvn-menu__tip{min-height:2.2cqh;font-size:1.9cqh;color:#9aa3c0;text-align:center}
.nilvn-menu__ver{margin-top:.4cqh;padding-top:1cqh;border-top:1px solid rgba(255,255,255,.1);font-size:1.7cqh;color:#7e87a3;text-align:center}
.nilvn-backlog{position:absolute;inset:0;z-index:60;display:none;flex-direction:column;background:rgba(10,12,20,.94);backdrop-filter:blur(3px)}
.nilvn-backlog.on{display:flex}
.nilvn-backlog__bar{flex:none;display:flex;justify-content:flex-end;padding:1.6cqh 1.6cqw}
.nilvn-backlog__close{padding:1cqh 2.4cqw;border-radius:.9cqh;background:rgba(40,46,74,.7);border:1px solid rgba(255,255,255,.18);color:#fff;font:inherit;font-size:2.2cqh;cursor:pointer}
.nilvn-backlog__close:hover{background:rgba(60,68,110,.85)}
.nilvn-backlog__list{flex:1;min-height:0;overflow-y:auto;padding:0 5cqw 3cqh;display:flex;flex-direction:column;gap:1.4cqh}
.nilvn-backlog__empty{margin:auto;color:#9aa3c0;font-size:2.4cqh}
.nilvn-backlog__row{display:flex;gap:1.4cqw;align-items:flex-start;padding:1.4cqh 1.8cqw;border-radius:1cqh;background:rgba(28,32,50,.6);border:1px solid rgba(255,255,255,.08)}
.nilvn-backlog__voice{flex:none;width:4.4cqh;height:4.4cqh;margin-top:.3cqh;border-radius:50%;background:rgba(255,93,158,.85);border:none;color:#fff;font-size:2cqh;cursor:pointer;line-height:1}
.nilvn-backlog__voice:hover{background:#ff5d9e}
.nilvn-backlog__body{flex:1;min-width:0}
.nilvn-backlog__who{font-size:2cqh;color:#ff9ec6;margin-bottom:.4cqh;font-weight:600}
.nilvn-backlog__text{font-size:2.3cqh;color:#e8ebf6;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.nilvn-saves__title{margin-right:auto;align-self:center;font-size:2.8cqh;font-weight:700;color:#fff}
.nilvn-saves__pages{flex:none;display:flex;gap:.8cqw;padding:0 5cqw 1.2cqh}
.nilvn-saves__page{flex:1;padding:.9cqh 0;border-radius:.8cqh;background:rgba(28,32,50,.6);border:1px solid rgba(255,255,255,.12);color:#aab2cc;font:inherit;font-size:2.1cqh;cursor:pointer}
.nilvn-saves__page.on{background:rgba(124,92,255,.4);border-color:rgba(150,130,255,.7);color:#fff}
.nilvn-saves__grid{flex:1;min-height:0;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:1.2cqh 1.2cqw;padding:0 5cqw 3cqh;align-content:start}
.nilvn-saves__slot{display:flex;flex-direction:column;align-items:flex-start;gap:.4cqh;padding:1.3cqh 1.6cqw;border-radius:1cqh;background:rgba(28,32,50,.5);border:1px solid rgba(255,255,255,.08);color:#8790ab;font:inherit;text-align:left;cursor:pointer;min-height:9cqh}
.nilvn-saves__slot:hover{border-color:rgba(150,130,255,.6);background:rgba(40,46,74,.7)}
.nilvn-saves__slot.has-data{color:#e8ebf6;background:rgba(34,40,64,.75)}
.nilvn-saves__no{font-size:1.9cqh;color:#9aa3c0;font-weight:700}
.nilvn-saves__when{font-size:2cqh}
.nilvn-saves__preview{font-size:2.1cqh;color:#c9cfe4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
`,
  activate(ctx: PluginContext): void {
    const caps = requireCaps(ctx)
    if (!caps) {
      ctx.report('menu needs session.save / session.settings / session.backlog / session.replay / ui.layer / timer — not shown')
      return
    }
    const { saves, settings, backlog, replay, ui, timer } = caps
    // Chrome strings follow THIS engine's work language (two engines on one page
    // each keep their own), re-read on every call so a switch repaints correctly.
    const T = (id: string, params?: Record<string, string | number>): string => ctx.t(id, params)
    // Host layers inside the stage root, in stacking order (removed on deactivate).
    const wrap = ui.layer('nilvn-menu')
    const backlogWrap = ui.layer('nilvn-backlog')
    const replaysWrap = ui.layer('nilvn-backlog') // same full-stage overlay chrome as the backlog
    const savesWrap = ui.layer('nilvn-backlog nilvn-saves')
    // Don't let menu clicks fall through to the stage's click-to-advance.
    wrap.addEventListener('click', (e) => e.stopPropagation())

    const btn = document.createElement('button')
    btn.className = 'nilvn-menu__btn'
    btn.type = 'button'
    btn.textContent = '☰'
    btn.title = T('plugin.menu.title')

    const panel = document.createElement('div')
    panel.className = 'nilvn-menu__panel'

    const tip = document.createElement('div')
    tip.className = 'nilvn-menu__tip'
    let tipTimer: number | undefined
    const flash = (msg: string): void => {
      tip.textContent = msg
      if (tipTimer !== undefined) timer.clearTimeout(tipTimer)
      tipTimer = timer.setTimeout(() => (tip.textContent = ''), 1800)
    }

    const item = (label: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement('button')
      b.className = 'nilvn-menu__item'
      b.type = 'button'
      b.textContent = label
      b.addEventListener('click', onClick)
      return b
    }

    // ---- save slots (10 pages × 10 = 100 VN-style slots) ----
    // One-time migration: the single-slot era's save becomes slot 0.
    try {
      const legacy = localStorage.getItem(saveKey(saves))
      if (legacy && !localStorage.getItem(slotKey(saves, 0))) {
        localStorage.setItem(slotKey(saves, 0), legacy)
        localStorage.removeItem(saveKey(saves))
      }
    } catch {
      /* storage unavailable */
    }

    /** Parse one slot: the wrapped `SlotPayload`, or a bare legacy SaveState
     *  (shown without metadata). null = empty / unreadable. */
    function readSlot(slot: number): { savedAt?: number; preview?: string; state: unknown } | null {
      try {
        const raw = localStorage.getItem(slotKey(saves, slot))
        if (!raw) return null
        const parsed = JSON.parse(raw) as Record<string, unknown>
        if (parsed && typeof parsed === 'object' && 'state' in parsed) {
          return { savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : undefined, preview: typeof parsed.preview === 'string' ? parsed.preview : undefined, state: parsed.state }
        }
        return parsed ? { state: parsed } : null
      } catch {
        return null
      }
    }

    function writeSlot(slot: number): boolean {
      // Preview = the line on screen right now (the freshest backlog entry).
      const last = backlog.entries().at(-1)
      const preview = last ? `${last.speaker ? last.speaker + ': ' : ''}${last.text}`.slice(0, 48) : ''
      const payload: SlotPayload = { v: 1, savedAt: Date.now(), preview, state: saves.saveState() }
      try {
        localStorage.setItem(slotKey(saves, slot), JSON.stringify(payload))
        return true
      } catch {
        return false
      }
    }

    // Full-stage slot screen, shared by save & load — the mode decides what a
    // click does. Page tabs across the top, a 10-slot grid below.
    let savesMode: 'save' | 'load' = 'save'
    let savesPage = 0
    savesWrap.addEventListener('click', (e) => e.stopPropagation())
    const savesBar = document.createElement('div')
    savesBar.className = 'nilvn-backlog__bar'
    const savesTitle = document.createElement('span')
    savesTitle.className = 'nilvn-saves__title'
    const savesClose = document.createElement('button')
    savesClose.type = 'button'
    savesClose.className = 'nilvn-backlog__close'
    savesClose.textContent = T('plugin.menu.close')
    savesClose.addEventListener('click', () => savesWrap.classList.remove('on'))
    savesBar.append(savesTitle, savesClose)
    const savesPages = document.createElement('div')
    savesPages.className = 'nilvn-saves__pages'
    const savesGrid = document.createElement('div')
    savesGrid.className = 'nilvn-saves__grid'
    savesWrap.append(savesBar, savesPages, savesGrid)

    function renderSaves(): void {
      savesTitle.textContent = savesMode === 'save' ? T('plugin.menu.save') : T('plugin.menu.load')
      savesPages.replaceChildren()
      for (let p = 0; p < SAVE_PAGES; p++) {
        const tab = document.createElement('button')
        tab.type = 'button'
        tab.className = 'nilvn-saves__page' + (p === savesPage ? ' on' : '')
        tab.textContent = String(p + 1)
        tab.addEventListener('click', () => {
          savesPage = p
          renderSaves()
        })
        savesPages.append(tab)
      }
      savesGrid.replaceChildren()
      for (let i = 0; i < SLOTS_PER_PAGE; i++) {
        const slot = savesPage * SLOTS_PER_PAGE + i
        const data = readSlot(slot)
        const cell = document.createElement('button')
        cell.type = 'button'
        cell.className = 'nilvn-saves__slot' + (data ? ' has-data' : '')
        const no = document.createElement('span')
        no.className = 'nilvn-saves__no'
        no.textContent = `${savesPage + 1}-${i + 1}`
        const when = document.createElement('span')
        when.className = 'nilvn-saves__when'
        when.textContent = data ? (data.savedAt ? new Date(data.savedAt).toLocaleString() : '—') : T('plugin.menu.msg.emptySlot')
        const prev = document.createElement('span')
        prev.className = 'nilvn-saves__preview'
        prev.textContent = data?.preview ?? ''
        cell.append(no, when, prev)
        cell.addEventListener('click', () => {
          if (savesMode === 'save') {
            if (data && !confirm(T('plugin.menu.msg.overwriteSlot'))) return
            if (writeSlot(slot)) renderSaves()
            else flash(T('plugin.menu.msg.saveFailed'))
          } else {
            if (!data) return
            void saves.restoreState(data.state as SaveState).then((ok) => {
              if (!ok) {
                flash(T('plugin.menu.msg.saveVersionMismatch'))
                return
              }
              replayStash = null // a load leaves any interrupted replay behind
              savesWrap.classList.remove('on')
              wrap.classList.remove('on')
            })
          }
        })
        savesGrid.append(cell)
      }
    }

    function openSaves(mode: 'save' | 'load'): void {
      savesMode = mode
      wrap.classList.remove('on')
      renderSaves()
      savesWrap.classList.add('on')
    }

    const loadBtn = item(T('plugin.menu.load'), () => openSaves('load'))
    const saveBtn = item(T('plugin.menu.save'), () => openSaves('save'))

    const restartBtn = item(T('plugin.menu.restart'), () => {
      if (!confirm(T('plugin.menu.msg.restartConfirm'))) return
      wrap.classList.remove('on')
      void saves.restart()
    })

    // Backlog — a full-stage scrollable list of played lines, rebuilt from
    // the engine's session backlog each time it opens; a per-line ▶ replays the
    // line's voice by ref (works even after its source chunk was released).
    backlogWrap.addEventListener('click', (e) => e.stopPropagation()) // don't advance the stage
    const backlogBar = document.createElement('div')
    backlogBar.className = 'nilvn-backlog__bar'
    const backlogClose = document.createElement('button')
    backlogClose.type = 'button'
    backlogClose.className = 'nilvn-backlog__close'
    backlogClose.textContent = T('plugin.menu.close')
    backlogClose.addEventListener('click', () => backlogWrap.classList.remove('on'))
    backlogBar.append(backlogClose)
    const backlogList = document.createElement('div')
    backlogList.className = 'nilvn-backlog__list'
    backlogWrap.append(backlogBar, backlogList)

    function renderBacklog(): void {
      backlogList.replaceChildren()
      const entries = backlog.entries()
      if (!entries.length) {
        const empty = document.createElement('div')
        empty.className = 'nilvn-backlog__empty'
        empty.textContent = T('plugin.menu.msg.noBacklog')
        backlogList.append(empty)
        return
      }
      for (const e of entries) {
        const row = document.createElement('div')
        row.className = 'nilvn-backlog__row'
        if (e.voiceRef) {
          const v = document.createElement('button')
          v.type = 'button'
          v.className = 'nilvn-backlog__voice'
          v.textContent = '▶'
          v.title = T('plugin.menu.msg.playVoice')
          const ref = e.voiceRef
          const off = e.offset
          v.addEventListener('click', () => void backlog.replayVoice(ref, off))
          row.append(v)
        }
        const body = document.createElement('div')
        body.className = 'nilvn-backlog__body'
        if (e.speaker) {
          const who = document.createElement('div')
          who.className = 'nilvn-backlog__who'
          who.textContent = e.speaker
          body.append(who)
        }
        const txt = document.createElement('div')
        txt.className = 'nilvn-backlog__text'
        txt.textContent = e.text
        body.append(txt)
        row.append(body)
        backlogList.append(row)
      }
    }
    function openBacklog(): void {
      wrap.classList.remove('on') // close the settings panel
      renderBacklog()
      backlogWrap.classList.add('on')
      backlogList.scrollTop = backlogList.scrollHeight // jump to the most recent line
    }
    const backlogBtn = item(T('plugin.menu.backlog'), openBacklog)

    // Classic VN affordance: wheeling UP over the stage opens the backlog (like
    // scrolling back through what was said). Once open, the wheel scrolls the
    // list natively — the guard lets those events through untouched.
    ui.onStage(
      'wheel',
      (e) => {
        if (backlogWrap.classList.contains('on')) return
        if (e.deltaY < 0) {
          e.preventDefault()
          openBacklog()
        }
      },
      { passive: false },
    )

    // ---- A–B replay segments ----
    // Unlock persistence: the engine fires onSegmentSeen when normal play passes
    // a segment's end marker; the set lives in localStorage per game, independent
    // of any save. The gallery lists every declared segment — unlocked ones play
    // as an isolated clean-slate replay; the interrupted session is stashed and
    // restored when the replay ends (its end marker) or the player backs out.
    function readUnlocks(): Set<string> {
      try {
        const raw = JSON.parse(localStorage.getItem(unlocksKey(saves)) || '[]') as unknown
        return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [])
      } catch {
        return new Set()
      }
    }
    replay.onSeen((segId) => {
      try {
        const s = readUnlocks()
        if (s.has(segId)) return
        s.add(segId)
        localStorage.setItem(unlocksKey(saves), JSON.stringify([...s]))
      } catch {
        /* storage unavailable — unlocks just won't persist */
      }
    })

    let replayStash: SaveState | null = null
    function exitReplay(): void {
      const stash = replayStash
      replayStash = null
      replaysWrap.classList.remove('on')
      if (stash) void saves.restoreState(stash)
    }
    replay.onEnd(exitReplay)

    // A segment's gallery title: resolve a keepKeys `@key` through the engine's
    // catalogs so it follows the live language; fall back to a numbered stand-in.
    function replayTitle(r: { title: string }, i: number): string {
      const raw = r.title.startsWith('@') ? settings.resolveText(r.title.slice(1)) : r.title
      return raw || `${T('plugin.menu.replays')} ${i + 1}`
    }

    replaysWrap.addEventListener('click', (e) => e.stopPropagation())
    const replaysBar = document.createElement('div')
    replaysBar.className = 'nilvn-backlog__bar'
    const replaysClose = document.createElement('button')
    replaysClose.type = 'button'
    replaysClose.className = 'nilvn-backlog__close'
    replaysClose.textContent = T('plugin.menu.close')
    replaysClose.addEventListener('click', () => replaysWrap.classList.remove('on'))
    replaysBar.append(replaysClose)
    const replaysList = document.createElement('div')
    replaysList.className = 'nilvn-backlog__list'
    replaysWrap.append(replaysBar, replaysList)

    function renderReplays(): void {
      replaysList.replaceChildren()
      const unlocked = readUnlocks()
      replay.list().forEach((r, i) => {
        const row = document.createElement('div')
        row.className = 'nilvn-backlog__row'
        const body = document.createElement('div')
        body.className = 'nilvn-backlog__body'
        const title = document.createElement('div')
        title.className = 'nilvn-backlog__who'
        if (unlocked.has(r.id)) {
          const play = document.createElement('button')
          play.type = 'button'
          play.className = 'nilvn-backlog__voice'
          play.textContent = '▶'
          play.title = replayTitle(r, i)
          play.addEventListener('click', () => {
            // Stash the interrupted session; the replay's end (or backing out)
            // restores it. Replaying FROM a replay keeps the original stash.
            if (!replayStash) replayStash = saves.saveState()
            replaysWrap.classList.remove('on')
            wrap.classList.remove('on')
            void replay.play(r.id)
          })
          row.append(play)
          title.textContent = replayTitle(r, i)
        } else {
          title.textContent = `🔒 ${T('plugin.menu.msg.replayLocked')}`
        }
        body.append(title)
        row.append(body)
        replaysList.append(row)
      })
    }
    const replaysBtn = item(T('plugin.menu.replays'), () => {
      wrap.classList.remove('on')
      renderReplays()
      replaysWrap.classList.add('on')
    })
    // Back out of a running replay to the stashed story session. Shown only while
    // a replay is playing (toggle() syncs it each time the menu opens).
    const exitReplayBtn = item(T('plugin.menu.replayExit'), () => {
      wrap.classList.remove('on')
      exitReplay()
    })

    // text speed
    const speedRow = document.createElement('div')
    speedRow.className = 'nilvn-menu__row'
    const speedLabelEl = Object.assign(document.createElement('span'), { textContent: T('plugin.menu.textSpeed') })
    speedRow.append(speedLabelEl)
    const seg = document.createElement('div')
    seg.className = 'nilvn-menu__seg'
    const speedBtns = SPEEDS.map((s) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = T(s.label)
      b.addEventListener('click', () => {
        settings.textSpeed = s.cps
        syncSpeed()
      })
      seg.append(b)
      return b
    })
    speedRow.append(seg)
    function syncSpeed(): void {
      speedBtns.forEach((b, i) => b.classList.toggle('on', settings.textSpeed === SPEEDS[i]!.cps))
    }
    syncSpeed()

    // volume (music / sfx / voice) — restore saved levels, then a slider per
    // channel that drives the engine live and persists the change.
    applySavedVolumes()
    const volRows = CHANNELS.map(({ label, key }) => {
      const row = document.createElement('div')
      row.className = 'nilvn-menu__row'
      const nameSpan = Object.assign(document.createElement('span'), { textContent: T(label) })
      row.append(nameSpan)
      const input = document.createElement('input')
      input.type = 'range'
      input.min = '0'
      input.max = '100'
      input.step = '1'
      input.className = 'nilvn-menu__vol'
      input.value = String(Math.round(settings.getVolume(key) * 100))
      const pct = document.createElement('span')
      pct.className = 'nilvn-menu__pct'
      pct.textContent = input.value + '%'
      input.addEventListener('input', () => {
        settings.setVolume(key, Number(input.value) / 100)
        pct.textContent = input.value + '%'
        saveVolumes()
      })
      row.append(input, pct)
      return { row, input, pct, key, nameSpan, label }
    })
    function applySavedVolumes(): void {
      let saved: Record<string, unknown> = {}
      try {
        saved = JSON.parse(localStorage.getItem(settingsKey(saves)) || '{}') as Record<string, unknown>
      } catch {
        /* corrupt / unavailable — keep engine defaults (1) */
      }
      for (const { key, store } of CHANNELS) {
        const v = saved[store]
        if (typeof v === 'number' && v >= 0 && v <= 1) settings.setVolume(key, v)
      }
    }
    function saveVolumes(): void {
      try {
        localStorage.setItem(settingsKey(saves), JSON.stringify(Object.fromEntries(CHANNELS.map(({ key, store }) => [store, settings.getVolume(key)]))))
      } catch {
        /* storage full / unavailable — settings just won't persist */
      }
    }
    function syncVolumes(): void {
      for (const { input, pct, key } of volRows) {
        const v = String(Math.round(settings.getVolume(key) * 100))
        input.value = v
        pct.textContent = v + '%'
      }
    }

    // language switch — only when the work ships more than one language (each
    // entry has a content catalog). Switching re-renders content + chrome live.
    const langBtns: { btn: HTMLButtonElement; lang: string }[] = []
    let langRow: HTMLDivElement | null = null
    let langLabelEl: HTMLSpanElement | null = null
    if (settings.languages.length > 1) {
      langRow = document.createElement('div')
      langRow.className = 'nilvn-menu__row'
      langLabelEl = Object.assign(document.createElement('span'), { textContent: T('plugin.menu.language') })
      langRow.append(langLabelEl)
      const lseg = document.createElement('div')
      lseg.className = 'nilvn-menu__seg'
      for (const lang of settings.languages) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = settings.languageName(lang)
        b.addEventListener('click', () => void settings.setLanguage(lang))
        lseg.append(b)
        langBtns.push({ btn: b, lang })
      }
      langRow.append(lseg)
    }
    function syncLang(): void {
      for (const { btn, lang } of langBtns) btn.classList.toggle('on', settings.lang === lang)
    }
    syncLang()

    // One grid for every label/control row: the label column is shared, so the
    // sliders line up and stay the same length in zh / en / ja (a per-row flex
    // sized each slider by its own label's width).
    const settingsGrid = document.createElement('div')
    settingsGrid.className = 'nilvn-menu__grid'
    settingsGrid.append(speedRow, ...volRows.map((v) => v.row))
    if (langRow) settingsGrid.append(langRow)
    panel.append(saveBtn, loadBtn, restartBtn, backlogBtn, replaysBtn, exitReplayBtn, settingsGrid, tip)
    // The gallery entry only exists when the work declares segments; the back-out
    // item only while a replay is running (synced on every menu open).
    replaysBtn.style.display = replay.list().length ? '' : 'none'
    exitReplayBtn.style.display = 'none'
    const ver = studioVersion(saves)
    let verEl: HTMLDivElement | null = null
    if (ver) {
      verEl = document.createElement('div')
      verEl.className = 'nilvn-menu__ver'
      verEl.textContent = T('plugin.menu.version', { ver })
      panel.append(verEl)
    }
    wrap.append(btn, panel)


    // Re-localize every chrome string when the player switches language.
    function applyLang(): void {
      btn.title = T('plugin.menu.title')
      loadBtn.textContent = T('plugin.menu.load')
      saveBtn.textContent = T('plugin.menu.save')
      restartBtn.textContent = T('plugin.menu.restart')
      backlogBtn.textContent = T('plugin.menu.backlog')
      backlogClose.textContent = T('plugin.menu.close')
      replaysBtn.textContent = T('plugin.menu.replays')
      exitReplayBtn.textContent = T('plugin.menu.replayExit')
      replaysClose.textContent = T('plugin.menu.close')
      savesClose.textContent = T('plugin.menu.close')
      if (replaysWrap.classList.contains('on')) renderReplays()
      if (savesWrap.classList.contains('on')) renderSaves()
      speedLabelEl.textContent = T('plugin.menu.textSpeed')
      speedBtns.forEach((b, i) => (b.textContent = T(SPEEDS[i]!.label)))
      volRows.forEach((v) => (v.nameSpan.textContent = T(v.label)))
      if (langLabelEl) langLabelEl.textContent = T('plugin.menu.language')
      if (verEl) verEl.textContent = T('plugin.menu.version', { ver })
      if (backlogWrap.classList.contains('on')) renderBacklog() // re-render open rows in the new language chrome
      syncLang()
    }
    settings.onLanguageChange(applyLang)

    const toggle = (): void => {
      const open = wrap.classList.toggle('on')
      if (open) {
        syncSpeed() // reflect the live text speed each time the panel opens
        syncVolumes()
        syncLang()
        // Replay state: no saving mid-replay (it's a clean-slate side session, not
        // story progress); the back-out item shows only while replaying.
        const replaying = replay.isReplaying() !== null
        saveBtn.disabled = replaying
        exitReplayBtn.style.display = replaying ? '' : 'none'
      }
    }
    btn.addEventListener('click', toggle)
    // Esc closes the replay gallery / backlog first if open, else toggles the
    // menu. Not preventDefault'd so the browser can still use Esc for fullscreen.
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (savesWrap.classList.contains('on')) {
        savesWrap.classList.remove('on')
        return
      }
      if (replaysWrap.classList.contains('on')) {
        replaysWrap.classList.remove('on')
        return
      }
      if (backlogWrap.classList.contains('on')) {
        backlogWrap.classList.remove('on')
        return
      }
      toggle()
    }
    ctx.listen(window, 'keydown', onKey as EventListener)
  },
}
