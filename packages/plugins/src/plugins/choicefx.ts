import type { EnginePlugin } from '@nilvn/engine'

// Animated choice buttons: staggered slide-in plus a shine sweep on hover.
// Pure hook + CSS — a good template for custom choice effects. Needs no capability.
export const choicefx: EnginePlugin = {
  id: 'app.nilvn.choicefx',
  permissions: [],
  styles: `
.nilvn-choice.cfx{position:relative;overflow:hidden;opacity:0;animation:cfx-in .5s cubic-bezier(.2,1.3,.4,1) forwards;animation-delay:var(--cfx-delay,0s)}
@keyframes cfx-in{from{opacity:0;transform:translateY(26px) scale(.95)}to{opacity:1;transform:none}}
.nilvn-choice.cfx::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,color-mix(in srgb,var(--nilvn-choice-color) 28%,transparent) 50%,transparent 60%);transform:translateX(-130%)}
.nilvn-choice.cfx:hover::after{transition:transform .5s ease;transform:translateX(130%)}
`,
  hooks: {
    onChoices(_items, choices) {
      for (const c of choices) {
        c.addClass('cfx')
        c.setVar('--cfx-delay', `${(c.index * 0.12).toFixed(2)}s`)
      }
    },
  },
}
