import type { EnginePlugin, PluginContext } from '@nilvn/engine'

// Per-character "voice blip" while text types out — the Undertale / Animal
// Crossing trick. Synthesized live with the Web Audio API (no audio files).
// Each actor gets a distinct pitch from its `voice` actor field (this plugin's
// `contributes.actorFields` entry), or a stable pitch hashed from its id, so
// different characters sound a little different. `[plugins.voicefx]` settings:
// `enabled` / `level` (player-adjustable), `wobble`.
//
// State is per activation: each context owns its own AudioContext + gesture
// listeners (registered through `ctx.listen`, so the host releases them on
// deactivate). Runs on `audio.play` — it reads the voice channel's volume and
// yields to a real per-line clip through that capability.

interface VoiceState {
  ac: AudioContext | null
  lastBlip: number
}
const states = new WeakMap<PluginContext, VoiceState>()

// Characters that shouldn't trigger a blip — whitespace and punctuation.
const SILENT = /[\s，。、！？；：…—·「」『』（）()【】[\]"'`.,!?;:~\-—]/

function audioContext(ctx: PluginContext): AudioContext | null {
  const st = states.get(ctx)
  if (!st) return null
  if (st.ac) return st.ac
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  const ac = new Ctor()
  st.ac = ac
  // Browsers start the context suspended until a user gesture.
  const resume = (): void => {
    if (ac.state === 'suspended') void ac.resume()
  }
  ctx.listen(window, 'pointerdown', resume)
  ctx.listen(window, 'keydown', resume)
  return ac
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/** Stable pitch in [200, 400) Hz derived from the speaker id */
function hashPitch(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return 200 + (h % 200)
}

export const voicefx: EnginePlugin = {
  id: 'app.nilvn.voicefx',
  permissions: ['audio.play'],
  activate(ctx) {
    states.set(ctx, { ac: null, lastBlip: 0 })
    ctx.onDispose(() => {
      const st = states.get(ctx)
      if (st?.ac) void st.ac.close().catch(() => {})
      states.delete(ctx)
    })
  },
  hooks: {
    onReveal(ch, _index, speaker, ctx) {
      if (ctx.config.get<boolean>('enabled') === false) return // the player switched blips off
      if (ctx.audio?.voicePlaying) return // a real per-line voice clip is playing — no synth blip
      if (!speaker || !ch || SILENT.test(ch)) return // narration & punctuation stay silent
      const ac = audioContext(ctx)
      if (!ac || ac.state !== 'running') return
      const st = states.get(ctx)
      if (!st) return
      // Throttle: caps blip rate regardless of text speed / fast-forward bursts.
      const now = performance.now()
      if (now - st.lastBlip < 55) return
      st.lastBlip = now

      // The blip stands in for the speaker's voice, so it rides the same
      // volume channel as real voice clips (the menu's Voice slider).
      const level = clamp01((ctx.audio?.volume('voice') ?? 1) * (ctx.config.get<number>('level') ?? 1))
      if (level <= 0) return

      // The actor's pitch is this plugin's actor field (contributes.actorFields).
      const declared = ctx.actorField(speaker, 'voice')
      const base = typeof declared === 'number' && declared > 0 ? declared : hashPitch(speaker)
      const wobble = ctx.config.get<number>('wobble') ?? 0.06
      const freq = base * (1 - wobble / 2 + Math.random() * wobble) // tiny per-blip wobble
      const t = ac.currentTime
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.1 * level, t + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
      osc.connect(gain).connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.08)
    },
  },
}
