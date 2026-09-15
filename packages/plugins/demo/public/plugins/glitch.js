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
    // [glitch duration=0.6 strength=14] — a jittery camera rumble through the
    // generic transform surface (keyframes are displacements from the current pose).
    async glitch({ num, plugin }) {
      const stage = plugin.stage
      if (!stage) return
      const strength = num('strength', 14)
      const duration = num('duration', 0.6)
      const steps = Math.max(6, Math.round(duration * 30))
      const frames = []
      for (let i = 0; i < steps; i++) {
        frames.push({ x: (Math.random() - 0.5) * strength * 2, y: (Math.random() - 0.5) * strength, rotation: (Math.random() - 0.5) * 2 })
      }
      frames.push({ x: 0, y: 0, rotation: 0 })
      await stage.animate('camera', frames, { durationSec: duration, easing: 'steps(2)', compose: 'offset' })
    },
  },

  textEffects: {
    // {glitch:text} — `span` is the sealed TextSpan handle (addClass only).
    glitch(span) {
      span.addClass('tfx-glitch')
    },
  },
}
