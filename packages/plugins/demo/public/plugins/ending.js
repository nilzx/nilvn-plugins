// A self-contained "ending" sequence as a plugin: result title card →
// staff roll → THE END + replay button. A game-specific finale lives entirely
// here; the script just calls [ending]. Click anywhere to skip the current step.
//
// [ending route=true|normal]   route also falls back to the `route_true` variable
//
// Plugin platform v2: the command never sees the engine or the stage DOM — it
// reads the route variable through `vars.read`, the work language and the
// character names through `session.settings`, and draws inside its own layer
// from `ui.layer` (released when the plugin is deactivated). Generic VN terms
// (TRUE END / STAFF / THE END …) stay in English on purpose; character names
// reuse the engine catalog so they match the dialogue exactly.

const T = {
  en: {
    title: 'The Secret Base',
    rOriginal: 'Story · Script',
    rEngine: 'Engine',
    rArt: 'Sprites · Backgrounds',
    rMusic: 'Music · SFX',
    rVoice: 'Voice',
    rFx: 'Direction · FX',
    vArt: 'Procedurally generated SVG',
    vMusic: 'Procedurally synthesized · Web Audio / WAV',
    vVoice: 'voicefx · realtime synthesis',
    endNameTrue: 'Back to That Starry Sky',
    endNameNormal: 'Tomorrow, We Set Out Again',
    endSubTrue: '"Your secret base — let\'s get it back, together."',
    endSubNormal: '"If the save is gone, we just go again."',
    thanksVal: 'You, who stayed by their side all along',
    replay: 'Play again',
  },
  ja: {
    title: '秘密基地',
    rOriginal: '原案 · 脚本',
    rEngine: 'エンジン',
    rArt: '立ち絵 · 背景',
    rMusic: '音楽 · 効果音',
    rVoice: 'ボイス',
    rFx: '演出 · エフェクト',
    vArt: 'プログラム生成 SVG',
    vMusic: 'プログラム合成 · Web Audio / WAV',
    vVoice: 'voicefx · リアルタイム合成',
    endNameTrue: 'あの星空へ、もう一度',
    endNameNormal: '明日、また歩き出そう',
    endSubTrue: '「君の秘密基地、もう一度取り戻そう。」',
    endSubNormal: '「セーブが消えても、もう一度行けばいい。」',
    thanksVal: 'ずっと二人に寄り添ってくれた、あなたへ',
    replay: 'もう一度遊ぶ',
  },
  zh: {
    title: '秘密基地',
    rOriginal: '原案 · 脚本',
    rEngine: '引擎',
    rArt: '立绘 · 背景',
    rMusic: '音乐 · 音效',
    rVoice: '对白配音',
    rFx: '演出特效',
    vArt: '程序化生成 SVG',
    vMusic: '程序化合成 · Web Audio / WAV',
    vVoice: 'voicefx · 实时合成',
    endNameTrue: '回到那片星空',
    endNameNormal: '明天，再出发',
    endSubTrue: '「你的秘密基地，我们再找回来一次吧。」',
    endSubNormal: '「存档没了，再去一次就是。」',
    thanksVal: '一直陪着她们的你',
    replay: '再玩一次',
  },
}

// Build the staff-roll rows for the active language. Character names come from
// the engine catalog (settings.resolveText) so they always match the dialogue.
function buildStaff(L, settings) {
  const cast = (key, fallback) => settings.resolveText(key) || fallback
  return [
    { h: L.title },
    { sub: 'A tiny ADV demo' },
    { gap: 2 },
    { head: 'STAFF' },
    { role: L.rOriginal, val: 'story.nvn' },
    { role: L.rEngine, val: 'NilVN' },
    { role: L.rArt, val: L.vArt },
    { role: L.rMusic, val: L.vMusic },
    { role: L.rVoice, val: L.vVoice },
    { role: L.rFx, val: 'screenfx · textfx · charfx · glitch' },
    { gap: 1 },
    { head: 'CAST' },
    { val: cast('actor.yuki', 'Yuki') },
    { val: cast('actor.rin', 'Rin') },
    { val: cast('actor.me', 'Me') },
    { gap: 2 },
  ]
}

function el(cls, text) {
  const d = document.createElement('div')
  d.className = cls
  if (text) d.textContent = text
  return d
}

export default {
  id: 'com.example.ending',
  permissions: ['vars.read', 'session.settings', 'ui.layer'],

  styles: `
.nilvn-ending{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;overflow:hidden;opacity:0;cursor:pointer;color:#eef0fa;background:radial-gradient(120% 100% at 50% 35%,#1c2348,#070a14 72%)}
.nilvn-ending-card{text-align:center;padding:0 6cqw}
.nilvn-ending-badge{font-size:2.4cqh;letter-spacing:.6em;color:#ffd98a;margin-bottom:2cqh;padding-left:.6em}
.nilvn-ending-name{font-size:8.5cqh;font-weight:800;letter-spacing:.08em;background:linear-gradient(90deg,#ff9ec4,#a78bff 58%,#7cc6ff);-webkit-background-clip:text;background-clip:text;color:transparent}
.nilvn-ending-sub{margin-top:2.6cqh;font-size:2.8cqh;color:#9aa3c4}
.nilvn-ending-roll{position:absolute;left:0;width:100%;box-sizing:border-box;padding:0 6cqw;text-align:center;will-change:transform}
.nilvn-roll-h{font-size:5.5cqh;font-weight:800;letter-spacing:.1em;color:#fff;margin:1cqh 0}
.nilvn-roll-sub{font-size:2.6cqh;color:#9aa3c4}
.nilvn-roll-head{font-size:2.1cqh;letter-spacing:.5em;color:#ffd98a;margin:0 0 1cqh;padding-left:.5em}
.nilvn-roll-row{margin-bottom:2.8cqh}
.nilvn-roll-role{font-size:1.9cqh;letter-spacing:.25em;color:#7e88ad}
.nilvn-roll-val{font-size:3cqh;color:#eef0fa;margin-top:.4cqh}
.nilvn-ending-fin{position:absolute;text-align:center;opacity:0}
.nilvn-ending-theend{font-size:6cqh;font-weight:300;letter-spacing:.5em;padding-left:.5em;color:#fff}
.nilvn-ending-replay{margin-top:4cqh;font:inherit;font-size:2.8cqh;color:#fff;cursor:pointer;background:linear-gradient(180deg,rgba(60,68,110,.92),rgba(34,40,68,.92));border:1px solid rgba(150,168,255,.5);border-radius:99px;padding:1.5cqh 4cqw;transition:transform .15s,box-shadow .15s}
.nilvn-ending-replay:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 8px 28px rgba(90,110,255,.35)}
`,

  commands: {
    async ending({ str, plugin }) {
      const { vars, settings, ui } = plugin
      if (!settings || !ui) return
      const isTrue = str('route') === 'true' || !!vars?.get('route_true')
      const L = T[settings.lang] || T.en
      const STAFF = buildStaff(L, settings)
      const overlay = ui.layer('nilvn-ending')

      // Click anywhere to fast-forward whatever step is currently animating.
      let current = null
      overlay.addEventListener('click', () => current && current.finish())
      const run = (node, frames, opts) => {
        const a = node.animate(frames, opts)
        current = a
        return a.finished.catch(() => {})
      }

      await run(overlay, [{ opacity: 0 }, { opacity: 1 }], { duration: 800, fill: 'forwards' })

      // 1) result title card
      const card = el('nilvn-ending-card')
      card.append(el('nilvn-ending-badge', isTrue ? 'TRUE END' : 'NORMAL END'))
      card.append(el('nilvn-ending-name', isTrue ? L.endNameTrue : L.endNameNormal))
      card.append(el('nilvn-ending-sub', isTrue ? L.endSubTrue : L.endSubNormal))
      overlay.append(card)
      await run(card, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], {
        duration: 1000,
        easing: 'ease-out',
        fill: 'forwards',
      })
      await run(card, [{ opacity: 1 }, { opacity: 1 }], { duration: 2600 }) // hold (skippable)
      await run(card, [{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: 'forwards' })
      card.remove()

      // 2) staff roll
      const rows = isTrue
        ? [...STAFF, { head: 'Special Thanks' }, { val: L.thanksVal }, { gap: 2 }, { h: 'Thanks for playing!' }]
        : [...STAFF, { h: 'Thanks for playing!' }]
      const roll = el('nilvn-ending-roll')
      for (const row of rows) {
        if (row.gap) {
          const g = document.createElement('div')
          g.style.height = `${row.gap * 6}cqh`
          roll.append(g)
        } else if (row.h) roll.append(el('nilvn-roll-h', row.h))
        else if (row.sub) roll.append(el('nilvn-roll-sub', row.sub))
        else if (row.head) roll.append(el('nilvn-roll-head', row.head))
        else {
          const r = el('nilvn-roll-row')
          if (row.role) r.append(el('nilvn-roll-role', row.role))
          r.append(el('nilvn-roll-val', row.val))
          roll.append(r)
        }
      }
      overlay.append(roll)
      const h = overlay.clientHeight
      const rh = roll.scrollHeight
      await run(
        roll,
        [{ transform: `translateY(${h}px)` }, { transform: `translateY(${-rh}px)` }],
        { duration: Math.max(9000, (h + rh) * 10), easing: 'linear', fill: 'forwards' },
      )
      roll.remove()
      current = null

      // 3) THE END + replay
      const fin = el('nilvn-ending-fin')
      fin.append(el('nilvn-ending-theend', 'THE END'))
      const btn = document.createElement('button')
      btn.className = 'nilvn-ending-replay'
      btn.textContent = '▶ ' + L.replay
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        location.reload()
      })
      fin.append(btn)
      overlay.append(fin)
      await run(fin, [{ opacity: 0 }, { opacity: 1 }], { duration: 900, fill: 'forwards' })
    },
  },
}
