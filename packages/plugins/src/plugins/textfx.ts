import type { EnginePlugin } from '@nilvn/engine'

// Inline text effects, used in dialogue as {wave:text} {rainbow:text} ...
// Each effect just tags the per-character span (via the sealed TextSpan handle's
// addClass — no raw DOM); CSS does the animating, staggered by the character index
// custom property --i. Needs no capability at all — the hot-plug demo plugin.
export const textfx: EnginePlugin = {
  id: 'app.nilvn.textfx',
  permissions: [],
  styles: `
.nilvn-ch.tfx-wave.on{animation:tfx-wave 1.1s ease-in-out infinite;animation-delay:calc(var(--i,0)*70ms)}
@keyframes tfx-wave{0%,100%{transform:translateY(0)}50%{transform:translateY(-.32em)}}
.nilvn-ch.tfx-shaky.on{animation:tfx-shaky .18s steps(2) infinite}
@keyframes tfx-shaky{0%{transform:translate(.04em,-.03em)}50%{transform:translate(-.05em,.04em)}100%{transform:translate(.03em,.02em)}}
.nilvn-ch.tfx-rainbow.on{color:#ff5c7a;animation:tfx-rainbow 1.6s linear infinite;animation-delay:calc(var(--i,0)*-90ms)}
@keyframes tfx-rainbow{to{filter:hue-rotate(360deg)}}
.nilvn-ch.tfx-pop.on{animation:tfx-pop .35s cubic-bezier(.2,1.6,.4,1) both}
@keyframes tfx-pop{from{transform:scale(0) rotate(-12deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}
.nilvn-ch.tfx-fadein.on{animation:tfx-fadein .8s ease both}
@keyframes tfx-fadein{from{opacity:0;filter:blur(4px)}to{opacity:1;filter:blur(0)}}
`,
  textEffects: {
    wave: (span) => span.addClass('tfx-wave'),
    shaky: (span) => span.addClass('tfx-shaky'),
    rainbow: (span) => span.addClass('tfx-rainbow'),
    pop: (span) => span.addClass('tfx-pop'),
    fadein: (span) => span.addClass('tfx-fadein'),
  },
}
