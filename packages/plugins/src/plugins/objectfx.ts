import type { EnginePlugin, StageObjectHandle, EffectParams } from '@nilvn/engine'

// Generic object effects. Each binds to the
// transformable kinds (camera / character / sprite) and drives only the shared
// transform schema through the object handle — no DOM, no kind-specific code, so a
// future plugin-contributed transformable kind picks them up for free. They extend
// the `appliesToKinds` decoupling `shake` established. These are the verbs the
// sprite playtest asked for (fade, scale, visibility, opacity); they live here rather
// than in screenfx because they act on any addressable object, not the screen.
//
// Each effect that animates also writes the resting model to its end state, so the
// change persists after the (fill-less) WAAPI run resolves — the keyframes only
// supply the visible transition between the prior and the new resting value.

const TRANSFORMABLE = ['camera', 'character', 'sprite']
/** Kinds that can change z-band: world objects with a movable element. The camera
 *  is the world wrapper itself, so it isn't bandable. */
const BANDABLE = ['character', 'sprite']

/** `screen` → the camera singleton, else `${kind}:${target}` — the shared
 *  target-resolution `shake` uses, so every object verb addresses objects alike. */
function targetId(target: string, kind: string): string {
  return target === 'screen' ? 'camera' : `${kind}:${target}`
}

/** Fade opacity 0↔1 and hold the end state. `dir=out` fades to invisible. */
async function applyFade(handle: StageObjectHandle, params: EffectParams): Promise<void> {
  const out = String(params.dir ?? 'in') === 'out'
  const duration = Number(params.duration) || 0.5
  const from = out ? 1 : 0
  const to = out ? 0 : 1
  handle.set('opacity', to)
  await handle.animate([{ opacity: from }, { opacity: to }], { durationSec: duration, easing: 'ease' })
}

/** Tween the uniform scale to `to` (camera target = a zoom) and hold it. */
async function applyScale(handle: StageObjectHandle, params: EffectParams): Promise<void> {
  const to = Number(params.to) || 1
  const duration = Number(params.duration) || 0.4
  const from = Number(handle.get('scale') ?? 1)
  handle.set('scale', to)
  await handle.animate([{ scale: from }, { scale: to }], { durationSec: duration, easing: 'ease' })
}

/** Set opacity to a specific alpha (0..1); animate the change when `duration>0`. */
function applyOpacity(handle: StageObjectHandle, params: EffectParams): Promise<void> | void {
  const to = Math.max(0, Math.min(1, Number(params.to ?? 1)))
  const duration = Number(params.duration) || 0
  const from = Number(handle.get('opacity') ?? 1)
  handle.set('opacity', to)
  if (duration > 0) return handle.animate([{ opacity: from }, { opacity: to }], { durationSec: duration, easing: 'ease' })
}

/** Toggle render visibility (keeps the object on stage; instant). */
function applyVisibility(handle: StageObjectHandle, params: EffectParams): void {
  handle.set('visible', String(params.vis ?? 'hide') !== 'hide')
}

/** Move the object between fixed z-bands: `front` lifts it over the dialogue box
 *  (out of world space), `world` returns it to its home band. Structural, not animated; instant. */
function applyLayer(handle: StageObjectHandle, params: EffectParams): void {
  handle.setBand(String(params.layer ?? 'front') === 'world' ? 'world' : 'front')
}

export const objectfx: EnginePlugin = {
  id: 'app.nilvn.objectfx',
  permissions: ['stage.write'],
  effects: {
    fade: { appliesToKinds: TRANSFORMABLE, apply: applyFade },
    scale: { appliesToKinds: TRANSFORMABLE, apply: applyScale },
    opacity: { appliesToKinds: TRANSFORMABLE, apply: applyOpacity },
    visibility: { appliesToKinds: TRANSFORMABLE, apply: applyVisibility },
    layer: { appliesToKinds: BANDABLE, apply: applyLayer },
  },
  commands: {
    // [fade target=screen|<id> kind=character|sprite dir=in|out duration=0.5]
    async fade(ctx) {
      const objId = targetId(ctx.str('target', 'screen'), ctx.str('kind', 'character'))
      await ctx.plugin.stage?.applyEffect('fade', objId, { dir: ctx.str('dir', 'in'), duration: ctx.num('duration', 0.5) })
    },
    // [scale target=… kind=… to=1.2 duration=0.4] — defaults MUST equal the core
    // manifest defaults (serialize.ts drops params equal to the default; a mismatch
    // would silently revert to the wrong fallback / 3b).
    async scale(ctx) {
      const objId = targetId(ctx.str('target', 'screen'), ctx.str('kind', 'character'))
      await ctx.plugin.stage?.applyEffect('scale', objId, { to: ctx.num('to', 1.2), duration: ctx.num('duration', 0.4) })
    },
    // [opacity target=… kind=… to=0.5 duration=0]
    async opacity(ctx) {
      const objId = targetId(ctx.str('target', 'screen'), ctx.str('kind', 'character'))
      await ctx.plugin.stage?.applyEffect('opacity', objId, { to: ctx.num('to', 0.5), duration: ctx.num('duration', 0) })
    },
    // [visibility target=… kind=… vis=hide|show]
    async visibility(ctx) {
      const objId = targetId(ctx.str('target', 'screen'), ctx.str('kind', 'character'))
      await ctx.plugin.stage?.applyEffect('visibility', objId, { vis: ctx.str('vis', 'hide') })
    },
    // [layer target=<id> kind=character|sprite layer=front|world] — promote over
    // the dialogue (front) or return to the home band (world). Camera isn't bandable.
    async layer(ctx) {
      const objId = targetId(ctx.str('target', 'screen'), ctx.str('kind', 'character'))
      await ctx.plugin.stage?.applyEffect('layer', objId, { layer: ctx.str('layer', 'front') })
    },
  },
}
