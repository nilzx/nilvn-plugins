import type { EnginePlugin, StageObjectHandle, EffectParams, TransformKeyframe } from '@nilvn/engine'

// Character effects. The pose presets (hop / nod / shake / swing) are now a single
// `pose` effect bound to the `character` kind: it feeds semantic TransformKeyframe[]
// to the object's generic `animate`, so the keyframes live with the effect (not the
// renderer) and any future renderable kind could reuse the same shape. `move` stays
// a thin positioning command (absolute slot, not the transform `x` offset).

// Box-relative keyframes (% of the sprite's own height/width), matching the
// pre-2a renderer presets exactly. `{}` is the resting pose (base anchor only).
const POSES: Record<string, TransformKeyframe[]> = {
  hop: [{}, { y: '-4.5%' }, {}, { y: '-2.5%' }, {}],
  nod: [{}, { y: '2.5%' }, {}],
  shake: [{}, { x: '-2.5%' }, { x: '2.5%' }, { x: '-1.5%' }, { x: '1.5%' }, {}],
  swing: [{ rotation: 0 }, { rotation: -2.5 }, { rotation: 2.5 }, { rotation: 0 }],
}

async function applyPose(handle: StageObjectHandle, params: EffectParams): Promise<void> {
  const preset = String(params.preset ?? 'hop')
  const frames = POSES[preset]
  if (!frames) throw new Error(`[charfx] unknown animation "${preset}" (try: ${Object.keys(POSES).join(', ')})`)
  // Pose presets are RELATIVE gestures: every channel is a displacement from the
  // element's resting pose, which `compose: 'offset'` is exactly. So `swing` rocks
  // around whatever angle the element was authored at, and `hop` jumps from wherever
  // an event-frame left it, instead of snapping either to zero for the duration.
  await handle.animate(frames, { durationSec: Number(params.duration) || 0.45, easing: 'ease-in-out', compose: 'offset' })
}

export const charfx: EnginePlugin = {
  id: 'app.nilvn.charfx',
  permissions: ['stage.write'],
  effects: {
    pose: { appliesToKinds: ['character'], apply: applyPose },
  },
  commands: {
    // [charfx yuki hop duration=0.4]
    async charfx(ctx) {
      const id = ctx.str(0)
      if (!id) return
      await ctx.plugin.stage?.applyEffect('pose', `character:${id}`, { preset: ctx.str(1, 'hop'), duration: ctx.num('duration', 0.45) })
    },

    // [move yuki to=left time=0.5]
    async move(ctx) {
      const id = ctx.str(0)
      if (id) await ctx.plugin.stage?.moveChar(id, ctx.str('to', 'center'), ctx.num('time', 0.45))
    },
  },
}
