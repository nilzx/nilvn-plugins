import type { AnimFrame, CommandContext, EnginePlugin, PluginContext, SavedLoop, TransformProp } from '@nilvn/engine'

// Keyframe animation authoring: the runtime half of the
// editor's recording features. Owns the animation commands the serializer emits
// for the editor's first-class nodes — [anim] (one-object clip, 4e), [eventframe]
// (scene-level multi-track choreography) and [loopstart]/[loopstop] (background
// single-element loops) — plus the save-state slice for loops running at save
// time. The rAF players, the keyframe wire codec and the loop bookkeeping are
// engine mechanisms reached through the stage capability (which accepts the wire
// tokens as written); this plugin is what CONNECTS scripts to them, so disabling
// it makes the commands inert without touching authored data.

// ---- [anim] keyframe track ----
// A recorded animation is a first-class AnimNode in the editor that serializes to
// an `[anim]` command. It plays a keyframe track on one stage object through the
// generic transform surface. Channels: x / y (px translate offsets from the birth
// position), scale / rotation / opacity (absolute). Every keyframe of a clip
// carries the same channel set, so playback never carries a value forward.

/** Short easing codes. The wire format reserves `, ; :` as separators, which a raw
 *  `cubic-bezier(...)` would collide with — so segment easings travel as codes
 *  (`e` + code, e.g. `eio`) and expand here. The codes never lead with `e`, the
 *  easing marker; channel codes never do either, so the two are unambiguous. An
 *  unknown code passes through ONLY when it is itself a valid CSS easing-function
 *  (see validEasing) — a malformed/imported code is dropped so it can never throw
 *  inside el.animate and strand a hold clip at its end pose (4e review). */
const ANIM_EASING: Record<string, string> = {
  lin: 'linear',
  in: 'ease-in',
  out: 'ease-out',
  io: 'ease-in-out',
  back: 'cubic-bezier(.34,1.56,.64,1)', // gentle overshoot
  hold: 'steps(1,jump-end)', // instant cut — the value holds until the next keyframe
}

const ANIM_CHANNEL: Record<string, TransformProp> = { x: 'x', y: 'y', s: 'scale', r: 'rotation', o: 'opacity' }
const ANIM_PROPS = ['x', 'y', 'scale', 'rotation', 'opacity'] as const

/** A WAAPI per-keyframe `easing` must be a valid CSS <easing-function>; an invalid
 *  one makes el.animate throw synchronously. Known ANIM_EASING values always pass;
 *  this only filters arbitrary passed-through codes (hand-authored / imported). */
function validEasing(v: string): boolean {
  try {
    return typeof CSS !== 'undefined' && CSS.supports('animation-timing-function', v)
  } catch {
    return false
  }
}

/** Decode the compact keyframe encoding into WAAPI-timed frames. Format: frames
 *  joined by `;`, each `<t>:<code><num>,<code><num>,…[,e<easeCode>]` (a bare `<t>`
 *  = an empty frame). Channel codes are x/y/s/r/o; an `e`-led token is the segment
 *  easing. `t` is seconds; the WAAPI offset is `t / duration`. */
function parseAnimFrames(s: string, durationSec: number): AnimFrame[] {
  const out: AnimFrame[] = []
  for (const raw of s.split(';')) {
    if (!raw) continue
    const ci = raw.indexOf(':')
    const t = parseFloat(ci < 0 ? raw : raw.slice(0, ci))
    if (!Number.isFinite(t)) continue
    const frame: AnimFrame = { offset: durationSec > 0 ? Math.max(0, Math.min(1, t / durationSec)) : 0 }
    if (ci >= 0) {
      for (const tok of raw.slice(ci + 1).split(',')) {
        if (!tok) continue
        const rest = tok.slice(1)
        if (tok[0] === 'e') {
          // Known code → its CSS easing; otherwise pass the raw token through only if
          // it is a valid CSS easing (else drop, so the segment uses the clip default
          // rather than throwing inside el.animate — 4e review).
          if (rest) {
            const ease = ANIM_EASING[rest] ?? rest
            if (validEasing(ease)) frame.easing = ease
          }
        } else {
          const prop = ANIM_CHANNEL[tok[0]!]
          const n = parseFloat(rest)
          if (prop && Number.isFinite(n)) (frame as Record<string, unknown>)[prop] = n
        }
      }
    }
    out.push(frame)
  }
  return out
}

/** The plugin's SaveState.ext slice: loops running at save time, restarted from
 *  their entry pose on load (cycle phase is NOT persisted — §4). */
interface AnimSaveSlice {
  loops: SavedLoop[]
}

export const animstudio: EnginePlugin = {
  id: 'app.nilvn.animstudio',
  permissions: ['stage.write', 'save.slice'],

  commands: {
    // [anim obj=character:yuki dur=1.2 hold=1 kf=0:x0,s1;1.2:x-120,s1.4,eio]
    // Plays a recorded keyframe track on one object. Blocking (awaited), so it runs
    // as its own beat. hold=1 persists the end pose; absent = transient.
    async anim(ctx: CommandContext) {
      const objId = ctx.str('obj')
      if (!objId) throw new Error('[anim] needs obj=<character:id|sprite:id|camera>')
      const stage = ctx.plugin.stage
      if (!stage) return
      const dur = ctx.num('dur', 1)
      const frames = parseAnimFrames(ctx.str('kf') ?? '', dur)
      if (frames.length === 0) return
      // hold: pre-write the end pose into the resting model before playing, so the
      // fill:none reveal lands on the end pose with no snap-back (objectfx pattern).
      if (ctx.str('hold') === '1') {
        const end: Partial<Record<TransformProp, number>> = {}
        for (const f of frames) for (const p of ANIM_PROPS) if (f[p] !== undefined) end[p] = f[p] as number
        for (const p of ANIM_PROPS) if (end[p] !== undefined) stage.setProp(objId, p, end[p]!)
      }
      await stage.animate(objId, frames, { durationSec: dur })
    },

    // [eventframe dur=2 kf=character:yuki#0:x=0,scale=1;1~io:x=-120,scale=1.3|camera#0:scale=1;2~io:scale=1.1]
    // Plays a recording event-frame: a one-shot, blocking,
    // multi-element keyframe choreography on a pure-JS rAF clock. The end pose
    // commits to the resting model; the save records only the node
    // position (atomic), so a load jumps to kf0.
    async eventframe(ctx: CommandContext) {
      const kf = ctx.str('kf')
      if (!kf) return
      await ctx.plugin.stage?.playFrames(ctx.num('dur', 1), kf)
    },

    // [loopstart obj=character:yuki dur=2 into=io entry=scale=1 body=0:scale=1;1~io:scale=1.05;2~io:scale=1]
    // Begin a single-element loop: snap the object to
    // the `entry` anchor, then play `body` on repeat through a background rAF clock.
    // Non-blocking — the command returns at once and the loop runs across later beats
    // until a matching [loopstop] (or a load / restart). `into` eases the object from
    // its live pose into the entry anchor over a short bridge.
    loopstart(ctx: CommandContext) {
      const objId = ctx.str('obj')
      if (!objId) throw new Error('[loopstart] needs obj=<character:id|sprite:id|camera>')
      ctx.plugin.stage?.startLoop(objId, ctx.num('dur', 1), ctx.str('entry', ''), ctx.str('body', ''), ctx.str('into'))
    },

    // [loopstop obj=character:yuki out=io exit=scale=1]
    // Stop the loop running on `obj` and settle it to the `exit` pose (committed to
    // the resting model). `out` eases the object from its live pose to the
    // exit over a short bridge.
    loopstop(ctx: CommandContext) {
      const objId = ctx.str('obj')
      if (!objId) throw new Error('[loopstop] needs obj=<character:id|sprite:id|camera>')
      ctx.plugin.stage?.stopLoop(objId, ctx.str('exit', ''), ctx.str('out'))
    },
  },

  // ---- save-state slice (SaveState.ext.animstudio) ----
  // The engine calls these around its own snapshot/restore: save runs after
  // settleExitBridges() so an in-flight exit lands on its exit pose first, and
  // restore runs AFTER the stage is restored, so applying each entry pose
  // overrides the (mid-phase) value the snapshot held for that channel — the
  // object lands on its anchor with no visible jump.

  saveState(ctx: PluginContext): unknown {
    const loops = ctx.stage?.runningLoops() ?? []
    return loops.length ? ({ loops } satisfies AnimSaveSlice) : undefined
  },

  restoreState(ctx: PluginContext, data: unknown): void {
    const slice = data as Partial<AnimSaveSlice> | undefined
    for (const l of slice?.loops ?? []) ctx.stage?.startLoop(l.objId, l.duration, l.entry, l.body, l.into, false)
  },
}
