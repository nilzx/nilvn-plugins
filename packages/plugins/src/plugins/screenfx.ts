import type { EnginePlugin, StageObjectHandle, EffectParams, PluginContext, TransformKeyframe } from '@nilvn/engine'

// Screen-level effects. `shake` is one effect bound to the `camera`, `character`,
// and `sprite` kinds (appliesToKinds) — the same decaying random rumble works on
// any of them, so `[shake]` (camera), `[shake target=yuki]` (a character), and a
// shaken `sprite:*` all share it, even though `sprite` is contributed by a
// different plugin (spriteanim). That cross-plugin reuse is exactly the decoupling
// `appliesToKinds` exists for. `flash` is a transient full-screen overlay, so it
// stays a renderer primitive behind a `screen`-kind effect. Neither touches the DOM.

/** Decaying random-offset keyframes (pixels) for a camera/character rumble. Played
 *  with `compose: 'offset'`, so these are DISPLACEMENTS from wherever the object
 *  currently sits — a shake on a panned camera rumbles the framing instead of
 *  yanking it back to the origin for the duration. */
function shakeFrames(strength: number, durationSec: number): TransformKeyframe[] {
  const steps = Math.max(6, Math.round(durationSec * 30))
  const frames: TransformKeyframe[] = []
  for (let i = 0; i < steps; i++) {
    const decay = 1 - i / steps
    const x = (Math.random() * 2 - 1) * strength * decay
    const y = (Math.random() * 2 - 1) * strength * decay * 0.6
    frames.push({ x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) })
  }
  frames.push({ x: 0, y: 0 })
  return frames
}

async function applyShake(handle: StageObjectHandle, params: EffectParams): Promise<void> {
  const strength = Number(params.strength) || 12
  const duration = Number(params.duration) || 0.45
  await handle.animate(shakeFrames(strength, duration), { durationSec: duration, easing: 'linear', compose: 'offset' })
}

async function applyFlash(_handle: StageObjectHandle, params: EffectParams, ctx: PluginContext): Promise<void> {
  // A screen-level effect reaches the renderer primitive through the owner's
  // `stage.write` capability (the object handle addresses one object, the flash
  // covers the screen). Fallback mirrors the manifest default (#ffffff) — a
  // `<input type=color>` always yields 6-digit hex, so the serializer drops `color`
  // only when it equals #ffffff.
  await ctx.stage?.flash(String(params.color ?? '#ffffff'), Number(params.duration) || 0.4)
}

/** Shaped scene transition over the renderer primitive. `to`=1 covers the screen
 *  (play before changing the scene), `to`=0 reveals it. Fallbacks mirror the
 *  manifest defaults exactly (the serializer drops params equal to them). */
function applyTransition(to: 0 | 1): (handle: StageObjectHandle, params: EffectParams, ctx: PluginContext) => Promise<void> {
  return async (_handle, params, ctx) => {
    const shape = params.type === 'circle' || params.type === 'blinds' ? params.type : 'wipe'
    const d = params.dir
    const dir = d === 'left' || d === 'up' || d === 'down' ? d : 'right'
    const mask = typeof params.mask === 'string' && params.mask ? params.mask : undefined
    await ctx.stage?.transitionScreen(to, Number(params.duration) || 0.6, { shape, dir, color: String(params.color ?? '#000000'), mask, softness: params.softness !== undefined ? Number(params.softness) : undefined })
  }
}

function transParams(ctx: { str: (k: string, d?: string) => string | undefined; num: (k: string, d?: number) => number; resolve: (p: string) => string }): EffectParams {
  const p: EffectParams = {
    type: ctx.str('type', 'wipe') ?? 'wipe',
    dir: ctx.str('dir', 'right') ?? 'right',
    duration: ctx.num('duration', 0.6),
    color: ctx.str('color', '#000000') ?? '#000000',
  }
  const mask = ctx.str('mask')
  if (mask) p.mask = ctx.resolve(mask)
  const softness = ctx.str('softness')
  if (softness !== undefined) p.softness = Number(softness)
  return p
}

export const screenfx: EnginePlugin = {
  id: 'app.nilvn.screenfx',
  permissions: ['stage.write'],
  effects: {
    shake: { appliesToKinds: ['camera', 'character', 'sprite'], apply: applyShake },
    flash: { appliesToKinds: ['screen'], apply: applyFlash },
    transout: { appliesToKinds: ['screen'], apply: applyTransition(1) },
    transin: { appliesToKinds: ['screen'], apply: applyTransition(0) },
  },
  commands: {
    // [shake strength=12 duration=0.45 target=screen|<objId> kind=character|sprite]
    // `kind` (default 'character') namespaces a non-screen target so the same verb
    // shakes a sprite (kind=sprite => sprite:id) without breaking [shake target=id].
    async shake(ctx) {
      const target = ctx.str('target', 'screen')
      const kind = ctx.str('kind', 'character')
      const objId = target === 'screen' ? 'camera' : `${kind}:${target}`
      await ctx.plugin.stage?.applyEffect('shake', objId, { strength: ctx.num('strength', 12), duration: ctx.num('duration', 0.45) })
    },

    // [flash color=#ffffff duration=0.4]
    async flash(ctx) {
      await ctx.plugin.stage?.applyEffect('flash', 'screen', { color: ctx.str('color', '#ffffff'), duration: ctx.num('duration', 0.4) })
    },

    // [transout type=wipe|circle|blinds dir=right duration=0.6 color=#000000
    // mask=@fx/rule.png softness=0.1] — cover the screen (change the scene while
    // it's hidden, then [transin]). A rule image replaces the shape. For a direct
    // old-to-new transition see the engine's `[trans …]` / `[bg trans=]`.
    async transout(ctx) {
      await ctx.plugin.stage?.applyEffect('transout', 'screen', transParams(ctx))
    },

    // [transin type=wipe dir=right duration=0.6 color=#000000 mask=] — reveal the screen.
    async transin(ctx) {
      await ctx.plugin.stage?.applyEffect('transin', 'screen', transParams(ctx))
    },
  },
}
