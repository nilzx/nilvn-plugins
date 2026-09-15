#!/usr/bin/env node
// Procedurally synthesize the demo's BGM and sound effects as WAV files.
// Same spirit as the hand-drawn SVG art: self-contained, no external assets,
// no licensing. Re-run with `pnpm gen:audio` to regenerate.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(import.meta.url), '../..')
const OUT = path.join(root, 'demo/public/assets')
const SR = 22050 // sample rate — plenty for soft synth tones, keeps files small

// ---- WAV writer (16-bit PCM mono) ----
function writeWavBuffer(samples) {
  const n = samples.length
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE((s < 0 ? s * 0x8000 : s * 0x7fff) | 0, 44 + i * 2)
  }
  return buf
}

const TAU = Math.PI * 2
const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12)

// Parse "C4", "F#3", "Bb2" -> MIDI number
function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name)
  if (!m) throw new Error(`bad note ${name}`)
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]]
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return base + acc + (parseInt(m[3], 10) + 1) * 12
}

// ---- voices ----
// Music-box / soft piano pluck: harmonics with a fast attack + exponential decay.
function addPluck(buf, start, dur, freq, gain) {
  const a = Math.floor(0.006 * SR)
  const len = Math.floor(dur * SR)
  for (let i = 0; i < len; i++) {
    const idx = start + i
    if (idx >= buf.length) break
    const t = i / SR
    const env = (i < a ? i / a : 1) * Math.exp(-t * 5.5)
    const w =
      Math.sin(TAU * freq * t) +
      0.42 * Math.sin(TAU * 2 * freq * t) +
      0.22 * Math.sin(TAU * 3 * freq * t) +
      0.1 * Math.sin(TAU * 4 * freq * t)
    buf[idx] += (w / 1.74) * env * gain
  }
}

// Warm sustained pad for the chord bed.
function addPad(buf, start, dur, freq, gain) {
  const len = Math.floor(dur * SR)
  const atk = 0.18 * SR
  const rel = 0.3 * SR
  for (let i = 0; i < len; i++) {
    const idx = start + i
    if (idx >= buf.length) break
    const t = i / SR
    let env = 1
    if (i < atk) env = i / atk
    else if (i > len - rel) env = Math.max(0, (len - i) / rel)
    const w = Math.sin(TAU * freq * t) + 0.5 * Math.sin(TAU * freq * 1.005 * t) + 0.3 * Math.sin(TAU * 2 * freq * t)
    buf[idx] += (w / 1.8) * env * gain
  }
}

// ---- a tiny feedback-comb reverb, bounded (g < 1) so it can't blow up ----
function reverb(buf, mix, taps) {
  const wet = new Float32Array(buf.length)
  for (let i = 0; i < buf.length; i++) {
    let v = buf[i]
    for (const [d, g] of taps) if (i >= d) v += g * wet[i - d]
    wet[i] = v
  }
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i] * (1 - mix) + wet[i] * mix
}

function normalize(buf, peak = 0.85) {
  let max = 0
  for (const s of buf) max = Math.max(max, Math.abs(s))
  if (max > 0) for (let i = 0; i < buf.length; i++) buf[i] = (buf[i] / max) * peak
}

// A warm I–V–vi–IV progression in C, the staple of gentle VN themes.
const PROGRESSION = [
  { arp: ['C4', 'E4', 'G4', 'C5'], pad: ['C4', 'E4', 'G4'], bass: 'C3' },
  { arp: ['G3', 'B3', 'D4', 'G4'], pad: ['G3', 'B3', 'D4'], bass: 'G2' },
  { arp: ['A3', 'C4', 'E4', 'A4'], pad: ['A3', 'C4', 'E4'], bass: 'A2' },
  { arp: ['F3', 'A3', 'C4', 'F4'], pad: ['F3', 'A3', 'C4'], bass: 'F2' },
]

function makeBgm({ eighth, padGain, arpGain, slow }) {
  const chordDur = eighth * 4
  // Loop body is an exact integer number of bars so the beat stays continuous.
  const loopN = Math.round(PROGRESSION.length * chordDur * SR)
  const tailN = Math.floor(1.6 * SR) // headroom for note decay + reverb past the loop point
  const buf = new Float32Array(loopN + tailN)
  let t = 0
  for (const chord of PROGRESSION) {
    const start = Math.floor(t * SR)
    // bass root, sustained across the chord
    addPad(buf, start, chordDur, midiToFreq(midi(chord.bass)), padGain * 0.9)
    // soft pad triad
    for (const n of chord.pad) addPad(buf, start, chordDur, midiToFreq(midi(n)), padGain * 0.5)
    // arpeggio (skip every other note when `slow` for a sparser night feel)
    chord.arp.forEach((n, i) => {
      if (slow && i % 2 === 1) return
      const at = Math.floor((t + i * eighth) * SR)
      const f = midiToFreq(midi(n))
      addPluck(buf, at, eighth * 2.2, f, arpGain * (1 - i * 0.07))
    })
    t += chordDur
  }
  reverb(buf, slow ? 0.4 : 0.28, [
    [Math.floor(0.083 * SR), 0.34],
    [Math.floor(0.131 * SR), 0.26],
    [Math.floor(0.197 * SR), 0.18],
  ])
  // Seamless loop: fold the tail (note ring-out + reverb spilling past the loop
  // point) back onto the head, so the wrap-around is continuous — no edge fade.
  const out = new Float32Array(loopN)
  out.set(buf.subarray(0, loopN))
  for (let i = loopN; i < buf.length; i++) out[i - loopN] += buf[i]
  normalize(out, 0.8)
  return out
}

// ---- sound effects ----
function noise() {
  return Math.random() * 2 - 1
}

function seSelect() {
  const len = Math.floor(0.2 * SR)
  const buf = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const f = t < 0.08 ? 880 : 1320 // two-tone confirm
    const env = Math.min(1, i / 30) * Math.exp(-((t - (t < 0.08 ? 0 : 0.08)) * 18))
    buf[i] += Math.sin(TAU * f * t) * env * 0.45
  }
  return buf
}

function seImpact() {
  const len = Math.floor(0.32 * SR)
  const buf = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const f = 150 * Math.exp(-t * 7) + 45 // pitch drop
    const body = Math.sin(TAU * f * t) * Math.exp(-t * 7)
    const transient = noise() * Math.exp(-t * 60) * 0.5
    buf[i] = (body + transient) * 0.85
  }
  return buf
}

function seGlitch() {
  const len = Math.floor(0.42 * SR)
  const buf = new Float32Array(len)
  let hold = 0
  let sample = 0
  for (let i = 0; i < len; i++) {
    const t = i / SR
    if (hold <= 0) {
      sample = noise()
      hold = 20 + Math.floor(Math.random() * 90) // sample-and-hold = bitcrush hiss
    }
    hold--
    const gate = Math.sin(TAU * 30 * t) > -0.2 ? 1 : 0.2 // stutter gate
    const env = (i < 80 ? i / 80 : 1) * Math.exp(-t * 4)
    buf[i] = sample * gate * env * 0.4
  }
  return buf
}

function seWhoosh() {
  const len = Math.floor(0.5 * SR)
  const buf = new Float32Array(len)
  let lp = 0
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const swell = Math.sin((Math.PI * i) / len) // rise then fall
    lp += (noise() - lp) * 0.08 // low-pass the noise for an airy band
    buf[i] = lp * swell * 0.5
  }
  return buf
}

async function main() {
  await fs.mkdir(path.join(OUT, 'bgm'), { recursive: true })
  await fs.mkdir(path.join(OUT, 'se'), { recursive: true })

  const files = {
    'bgm/daily.wav': makeBgm({ eighth: 0.28, padGain: 0.5, arpGain: 0.6, slow: false }),
    'bgm/night.wav': makeBgm({ eighth: 0.42, padGain: 0.55, arpGain: 0.5, slow: true }),
    'se/select.wav': seSelect(),
    'se/impact.wav': seImpact(),
    'se/glitch.wav': seGlitch(),
    'se/whoosh.wav': seWhoosh(),
  }

  for (const [rel, samples] of Object.entries(files)) {
    const buf = writeWavBuffer(samples)
    await fs.writeFile(path.join(OUT, rel), buf)
    console.log(`  ${rel}  (${(buf.length / 1024).toFixed(0)} kB)`)
  }
  console.log('✓ audio generated')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
