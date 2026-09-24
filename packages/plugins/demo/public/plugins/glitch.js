// A custom effect plugin written in plain JS — no build step needed.
// The script imports it with: [use ./plugins/glitch.js]
//
// A plugin is one object: { id, permissions?, styles?, commands?, textEffects?,
// hooks?, activate?, deactivate? } (plugin platform v2). Commands never see the
// engine or the DOM — they get the parsed tag plus `ctx.plugin`, whose capability
// objects exist only for the permissions declared below.

export default {
  id: 'com.example.glitch',
  permissions: ['stage.write'],

  styles: `
.nilvn-ch.tfx-glitch.on{animation:tfx-glitch .28s steps(2) infinite}
@keyframes tfx-glitch{
  0%{transform:translate(0,0);text-shadow:2px 0 #ff3ef0,-2px 0 #2ef0ff}
  50%{transform:translate(1px,-1px);text-shadow:-2px 0 #ff3ef0,2px 0 #2ef0ff}
  100%{transform:translate(-1px,1px);text-shadow:2px 0 #2ef0ff,-2px 0 #ff3ef0}
}`,

  commands: {
    // [glitch duration=0.6 strength=14] — a jittery camera rumble with colour
    // flashes, through the generic transform surface: keyframes are displacements
    // from the current pose (compose 'offset'), and the camera's colour-grade
    // channels (hue / invert / saturate / contrast) flash on some of them. Each
    // keyframe holds until the next (per-frame steps(1)), a hard cut every ~33 ms.
    async glitch({ num, plugin }) {
      const stage = plugin.stage
      if (!stage) return
      const strength = num('strength', 14)
      const duration = num('duration', 0.6)
      const steps = Math.max(6, Math.round(duration * 30))
      const clear = { hue: 0, invert: 0, saturate: 1, contrast: 1 }
      const frames = []
      for (let i = 0; i < steps; i++) {
        const r = Math.random()
        const colour = r < 0.35 ? { hue: Math.round(r * 360), invert: 0, saturate: 4, contrast: 1.4 } : r < 0.5 ? { ...clear, invert: 1 } : clear
        frames.push({ x: (r - 0.5) * strength * 2, y: (Math.random() - 0.5) * strength, rotation: (Math.random() - 0.5) * 2, ...colour, easing: 'steps(1, end)' })
      }
      frames.push({ x: 0, y: 0, rotation: 0, ...clear })
      await stage.animate('camera', frames, { durationSec: duration, easing: 'linear', compose: 'offset' })
    },
  },

  textEffects: {
    // {glitch:text} — `span` is the sealed TextSpan handle (addClass only).
    glitch(span) {
      span.addClass('tfx-glitch')
    },
  },
}
