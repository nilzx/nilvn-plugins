import type { EnginePlugin } from '@nilvn/engine'

// Sprite-frame animation — the first stage-object *kind* contributed by a plugin
// rather than the engine. The split mirrors the rest of the
// object model: the engine renderer owns the frame-stepping primitive (CSS `steps()`
// over a single-row spritesheet — see DomRenderer.showSprite), while this plugin
// owns the declarative `sprite` kind and the author vocabulary (`[sprite …]`).
//
// Because the kind is `transformable`, the sprite joins the generic transform
// surface for free: setProp / animate and any effect bound to its kind (e.g.
// screenfx `shake`, whose `appliesToKinds` now lists `sprite`) operate on it with
// no sprite-specific code — the appliesToKinds decoupling the model is built around.

export const spriteanim: EnginePlugin = {
  id: 'app.nilvn.spriteanim',
  permissions: ['stage.write'],
  // The sprite reuses the engine's standard channels by name: the full continuous
  // transform set (+ visibility) plus the discrete `band` channel. Its own
  // frame index stays out of the recordable set — it's an autoplaying
  // CSS `steps()` loop, not a settable pose.
  objectKinds: [{ id: 'sprite', label: 'objectKind.sprite', transformable: true, recordable: ['x', 'y', 'scale', 'rotation', 'opacity', 'visible', 'band'] }],
  commands: {
    // [sprite star @fx/sparkle.svg frames=8 fps=10 loop=true at=center height=30
    // onclick="jump star_scene" if=!seen_star] — `onclick` makes the sprite
    // clickable: the engine runs those script commands (one per line) on a click.
    // A false `if=` (declared `ifFalse: 'handle'`) takes the sprite off the stage.
    async sprite(ctx) {
      const id = ctx.str(0)
      const sheet = ctx.str(1)
      if (!ctx.cond) {
        if (id) await ctx.plugin.stage?.hideSprite(id, ctx.num('fade', 0.3))
        return
      }
      if (!id || !sheet) throw new Error('[sprite] syntax: [sprite <id> <sheet> frames= fps= loop= at= height=]')
      await ctx.plugin.stage?.showSprite(
        id,
        {
          url: ctx.resolve(sheet),
          ref: sheet,
          frames: ctx.num('frames', 1),
          fps: ctx.num('fps', 12),
          loop: ctx.str('loop') !== 'false',
          at: ctx.str('at'),
          height: ctx.num('height', 30),
          y: ctx.numOpt('y'),
          scale: ctx.numOpt('scale'),
          rotation: ctx.numOpt('rotation'),
          onclick: ctx.str('onclick'),
        },
        ctx.num('fade', 0.3),
      )
    },

    // [hidesprite star fade=0.3]
    async hidesprite(ctx) {
      const id = ctx.str(0)
      if (id) await ctx.plugin.stage?.hideSprite(id, ctx.num('fade', 0.3))
    },
  },
}
