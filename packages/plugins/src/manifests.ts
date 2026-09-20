// The first-party plugin inventory: one manifest per plugin (plugin platform v2,
// @nilvn/core's `PluginManifest`), the declarative half the hosts read — the
// editor renders its plugins panel and insert palette from these, the authoring
// tools lint against them, the engine takes them next to the runtime modules so
// `ctx.t` and the permission gate see each plugin's declaration. Executable
// halves: ./plugins/*.ts (runtime, this package) and the editor's own modules.
//
// This file is DOM-free and imports nothing at runtime (types only), so a
// node-side host can read it through `@nilvn/plugins/manifests` without the
// runtime modules.
//
// `menu` is the finished-game shell (save / load / settings), always enabled by
// the exporter and never an author-toggled content plugin: it is kept OUT of
// `firstPartyManifests` (the content set) and exported on its own.

import type { CommandSchema, PluginManifest } from '@nilvn/core'
import { PLUGIN_MESSAGES } from './messages.js'

/** = core / engine FIRST_PARTY_ID_PREFIX (the contract test pins the ids to it).
 *  A first-party id also answers to its short name. */
const FIRST_PARTY_ID_PREFIX = 'app.nilvn.'
/** = core BUNDLED_ENTRY: the host's own registry supplies the module. */
const HOST_REGISTRY = 'bundled'

/** First-party short names → stable ids. */
export const FIRST_PARTY_IDS = Object.freeze({
  textfx: 'app.nilvn.textfx',
  charfx: 'app.nilvn.charfx',
  choicefx: 'app.nilvn.choicefx',
  screenfx: 'app.nilvn.screenfx',
  objectfx: 'app.nilvn.objectfx',
  spriteanim: 'app.nilvn.spriteanim',
  voicefx: 'app.nilvn.voicefx',
  voicerecord: 'app.nilvn.voicerecord',
  animstudio: 'app.nilvn.animstudio',
  abreplay: 'app.nilvn.abreplay',
})

export type FirstPartyName = keyof typeof FIRST_PARTY_IDS

/** `textfx` → `app.nilvn.textfx`; an id (anything with a dot) as-is. Mirrors
 *  core's `resolvePluginId` without importing core at runtime. */
function resolveId(nameOrId: string): string {
  return nameOrId.includes('.') ? nameOrId : FIRST_PARTY_ID_PREFIX + nameOrId
}

/** `app.nilvn.textfx` → `textfx` (mirrors core's `pluginSlug`). */
function slug(id: string): string {
  const i = id.lastIndexOf('.')
  return i < 0 ? id : id.slice(i + 1)
}

const BUNDLED = (name: FirstPartyName): string => FIRST_PARTY_IDS[name]

const CHARFX_COMMANDS: CommandSchema[] = [
  {
    name: 'charfx',
    label: 'plugin.charfx.cmd.charfx.label',
    category: 'fx',
    icon: '🤸',
    hint: 'plugin.charfx.cmd.charfx.hint',
    params: [
      { key: 'id', label: 'plugin.charfx.cmd.charfx.id', type: 'actor', required: true, positional: 0 },
      {
        key: 'preset',
        label: 'plugin.charfx.cmd.charfx.preset',
        type: 'enum',
        default: 'hop',
        positional: 1,
        options: [
          { value: 'hop', label: 'plugin.charfx.cmd.charfx.preset.hop' },
          { value: 'nod', label: 'plugin.charfx.cmd.charfx.preset.nod' },
          { value: 'shake', label: 'plugin.charfx.cmd.charfx.preset.shake' },
          { value: 'swing', label: 'plugin.charfx.cmd.charfx.preset.swing' },
        ],
      },
      { key: 'duration', label: 'plugin.charfx.cmd.charfx.duration', type: 'number', default: 0.45 },
    ],
  },
  {
    name: 'move',
    label: 'plugin.charfx.cmd.move.label',
    category: 'stage',
    icon: '↔️',
    hint: 'plugin.charfx.cmd.move.hint',
    params: [
      { key: 'id', label: 'plugin.charfx.cmd.move.id', type: 'actor', required: true, positional: 0 },
      {
        key: 'to',
        label: 'plugin.charfx.cmd.move.to',
        type: 'enum',
        default: 'center',
        options: [
          { value: 'left', label: 'plugin.charfx.cmd.move.to.left' },
          { value: 'center', label: 'plugin.charfx.cmd.move.to.center' },
          { value: 'right', label: 'plugin.charfx.cmd.move.to.right' },
        ],
      },
      { key: 'time', label: 'plugin.charfx.cmd.move.time', type: 'number', default: 0.45 },
    ],
  },
]

/** The shared param set of the two transition verbs. */
const TRANS_PARAMS = (): CommandSchema['params'] => [
  {
    key: 'type',
    label: 'plugin.screenfx.cmd.trans.type',
    type: 'enum',
    default: 'wipe',
    options: [
      { value: 'wipe', label: 'plugin.screenfx.cmd.trans.type.wipe' },
      { value: 'circle', label: 'plugin.screenfx.cmd.trans.type.circle' },
      { value: 'blinds', label: 'plugin.screenfx.cmd.trans.type.blinds' },
    ],
  },
  {
    key: 'dir',
    label: 'plugin.screenfx.cmd.trans.dir',
    type: 'enum',
    default: 'right',
    options: [
      { value: 'right', label: 'plugin.screenfx.cmd.trans.dir.right' },
      { value: 'left', label: 'plugin.screenfx.cmd.trans.dir.left' },
      { value: 'up', label: 'plugin.screenfx.cmd.trans.dir.up' },
      { value: 'down', label: 'plugin.screenfx.cmd.trans.dir.down' },
    ],
  },
  { key: 'duration', label: 'plugin.screenfx.cmd.trans.duration', type: 'number', default: 0.6 },
  { key: 'color', label: 'plugin.screenfx.cmd.trans.color', type: 'color', default: '#000000' },
]

const SCREENFX_COMMANDS: CommandSchema[] = [
  {
    name: 'shake',
    label: 'plugin.screenfx.cmd.shake.label',
    category: 'fx',
    icon: '💥',
    hint: 'plugin.screenfx.cmd.shake.hint',
    params: [
      { key: 'strength', label: 'plugin.screenfx.cmd.shake.strength', type: 'number', default: 12 },
      { key: 'duration', label: 'plugin.screenfx.cmd.shake.duration', type: 'number', default: 0.45 },
      { key: 'target', label: 'plugin.screenfx.cmd.shake.target', type: 'string', default: 'screen', advanced: true },
      // The target's kind; default 'character' keeps the legacy `[shake target=id]`
      // form (=> character:id). The object-effects palette sets it (e.g. sprite).
      { key: 'kind', label: 'plugin.screenfx.cmd.shake.kind', type: 'string', default: 'character', advanced: true },
    ],
  },
  {
    name: 'flash',
    label: 'plugin.screenfx.cmd.flash.label',
    category: 'fx',
    icon: '⚡',
    hint: 'plugin.screenfx.cmd.flash.hint',
    params: [
      { key: 'color', label: 'plugin.screenfx.cmd.flash.color', type: 'color', default: '#ffffff' },
      { key: 'duration', label: 'plugin.screenfx.cmd.flash.duration', type: 'number', default: 0.4 },
    ],
  },
  { name: 'transout', label: 'plugin.screenfx.cmd.transout.label', category: 'fx', icon: '🌒', hint: 'plugin.screenfx.cmd.transout.hint', params: TRANS_PARAMS() },
  { name: 'transin', label: 'plugin.screenfx.cmd.transin.label', category: 'fx', icon: '🌔', hint: 'plugin.screenfx.cmd.transin.hint', params: TRANS_PARAMS() },
]

/** The `target` / `kind` pair every object verb takes (screen → camera, else kind:id). */
const TARGET_PARAMS = (cmd: string): CommandSchema['params'] => [
  { key: 'target', label: `plugin.objectfx.cmd.${cmd}.target`, type: 'string', default: 'screen', advanced: true },
  { key: 'kind', label: `plugin.objectfx.cmd.${cmd}.kind`, type: 'string', default: 'character', advanced: true },
]

const OBJECTFX_COMMANDS: CommandSchema[] = [
  {
    name: 'fade',
    label: 'plugin.objectfx.cmd.fade.label',
    category: 'fx',
    icon: '🌗',
    hint: 'plugin.objectfx.cmd.fade.hint',
    params: [
      {
        key: 'dir',
        label: 'plugin.objectfx.cmd.fade.dir',
        type: 'enum',
        default: 'in',
        options: [
          { value: 'in', label: 'plugin.objectfx.cmd.fade.dir.in' },
          { value: 'out', label: 'plugin.objectfx.cmd.fade.dir.out' },
        ],
      },
      { key: 'duration', label: 'plugin.objectfx.cmd.fade.duration', type: 'number', default: 0.5 },
      ...TARGET_PARAMS('fade'),
    ],
  },
  {
    name: 'scale',
    label: 'plugin.objectfx.cmd.scale.label',
    category: 'fx',
    icon: '🔍',
    hint: 'plugin.objectfx.cmd.scale.hint',
    params: [
      { key: 'to', label: 'plugin.objectfx.cmd.scale.to', type: 'number', default: 1.2 },
      { key: 'duration', label: 'plugin.objectfx.cmd.scale.duration', type: 'number', default: 0.4 },
      ...TARGET_PARAMS('scale'),
    ],
  },
  {
    name: 'opacity',
    label: 'plugin.objectfx.cmd.opacity.label',
    category: 'fx',
    icon: '👻',
    hint: 'plugin.objectfx.cmd.opacity.hint',
    params: [
      { key: 'to', label: 'plugin.objectfx.cmd.opacity.to', type: 'number', default: 0.5 },
      { key: 'duration', label: 'plugin.objectfx.cmd.opacity.duration', type: 'number', default: 0 },
      ...TARGET_PARAMS('opacity'),
    ],
  },
  {
    name: 'visibility',
    label: 'plugin.objectfx.cmd.visibility.label',
    category: 'fx',
    icon: '🙈',
    hint: 'plugin.objectfx.cmd.visibility.hint',
    params: [
      {
        key: 'vis',
        label: 'plugin.objectfx.cmd.visibility.vis',
        type: 'enum',
        default: 'hide',
        options: [
          { value: 'hide', label: 'plugin.objectfx.cmd.visibility.vis.hide' },
          { value: 'show', label: 'plugin.objectfx.cmd.visibility.vis.show' },
        ],
      },
      ...TARGET_PARAMS('visibility'),
    ],
  },
  {
    name: 'layer',
    label: 'plugin.objectfx.cmd.layer.label',
    category: 'fx',
    icon: '🔼',
    hint: 'plugin.objectfx.cmd.layer.hint',
    params: [
      {
        key: 'layer',
        label: 'plugin.objectfx.cmd.layer.layer',
        type: 'enum',
        default: 'front',
        options: [
          { value: 'front', label: 'plugin.objectfx.cmd.layer.layer.front' },
          { value: 'world', label: 'plugin.objectfx.cmd.layer.layer.world' },
        ],
      },
      ...TARGET_PARAMS('layer'),
    ],
  },
]

/** Per-kind target params the object-effects palette writes (camera = the screen
 *  singleton, others address `kind:id`). */
const OBJECT_TARGETS = {
  camera: { target: 'screen' },
  character: { target: '$id' },
  sprite: { target: '$id', kind: 'sprite' },
}

const SPRITEANIM_COMMANDS: CommandSchema[] = [
  {
    name: 'sprite',
    label: 'plugin.spriteanim.cmd.sprite.label',
    category: 'stage',
    icon: '🎞️',
    hint: 'plugin.spriteanim.cmd.sprite.hint',
    params: [
      // Positionals must match the engine handler reads (ctx.str(0)/str(1));
      // the rest are named with defaults aligned to the handler fallbacks so a
      // default-valued param can drop from the DSL without changing behavior.
      { key: 'id', label: 'plugin.spriteanim.cmd.sprite.id', type: 'string', required: true, positional: 0 },
      { key: 'sheet', label: 'plugin.spriteanim.cmd.sprite.sheet', type: 'asset:sprite', required: true, positional: 1 },
      { key: 'frames', label: 'plugin.spriteanim.cmd.sprite.frames', type: 'number', default: 1 },
      { key: 'fps', label: 'plugin.spriteanim.cmd.sprite.fps', type: 'number', default: 12 },
      { key: 'loop', label: 'plugin.spriteanim.cmd.sprite.loop', type: 'boolean', default: true },
      {
        key: 'at',
        label: 'plugin.spriteanim.cmd.sprite.at',
        type: 'enum',
        default: 'center',
        options: [
          { value: 'left', label: 'plugin.spriteanim.cmd.sprite.at.left' },
          { value: 'center', label: 'plugin.spriteanim.cmd.sprite.at.center' },
          { value: 'right', label: 'plugin.spriteanim.cmd.sprite.at.right' },
        ],
      },
      { key: 'height', label: 'plugin.spriteanim.cmd.sprite.height', type: 'number', default: 30 },
      // Birth transform — written by the stage drag / scale / rotate handles (4c-4).
      // No schema default: these channels carry forward (see commands.ts `char`).
      { key: 'y', label: 'plugin.spriteanim.cmd.sprite.y', type: 'number', advanced: true },
      { key: 'scale', label: 'plugin.spriteanim.cmd.sprite.scale', type: 'number', advanced: true },
      { key: 'rotation', label: 'plugin.spriteanim.cmd.sprite.rotation', type: 'number', advanced: true },
      { key: 'fade', label: 'plugin.spriteanim.cmd.sprite.fade', type: 'number', default: 0.3, advanced: true },
    ],
  },
  {
    name: 'hidesprite',
    label: 'plugin.spriteanim.cmd.hidesprite.label',
    category: 'stage',
    icon: '🚪',
    hint: 'plugin.spriteanim.cmd.hidesprite.hint',
    params: [
      { key: 'id', label: 'plugin.spriteanim.cmd.hidesprite.id', type: 'string', required: true, positional: 0 },
      { key: 'fade', label: 'plugin.spriteanim.cmd.hidesprite.fade', type: 'number', default: 0.3 },
    ],
  },
]

/** Engine compatibility every bundled runtime half declares (the platform they
 *  were written against; bumped with the plugin contract, not per release). */
const ENGINE_RANGE = '>=0.15 <1'
const EDITOR_RANGE = '>=0.15 <1'

/** Built-in content plugins, shown in the editor's plugin panel. */
export const firstPartyManifests: PluginManifest[] = [
  {
    id: BUNDLED('textfx'),
    name: 'plugin.textfx.name',
    description: 'plugin.textfx.desc',
    version: '1.0.0',
    engine: ENGINE_RANGE,
    entries: { engine: HOST_REGISTRY },
    // Text effects only tag character spans with a class; no capability needed.
    permissions: [],
    contributes: {
      textEffects: [
        { name: 'wave', label: 'plugin.textfx.te.wave.label' },
        { name: 'shaky', label: 'plugin.textfx.te.shaky.label' },
        { name: 'rainbow', label: 'plugin.textfx.te.rainbow.label' },
        { name: 'pop', label: 'plugin.textfx.te.pop.label' },
        { name: 'fadein', label: 'plugin.textfx.te.fadein.label' },
      ],
    },
    authorUsage: [
      'Inline in dialogue text:',
      '  {wave:text} {shaky:text} {rainbow:text} {pop:text} {fadein:text} — wave / shake / rainbow / pop / fade-in',
    ],
  },
  {
    id: BUNDLED('charfx'),
    name: 'plugin.charfx.name',
    description: 'plugin.charfx.desc',
    version: '1.0.0',
    engine: ENGINE_RANGE,
    entries: { engine: HOST_REGISTRY },
    permissions: ['stage.write'],
    contributes: {
      commands: CHARFX_COMMANDS,
      effects: [
        {
          name: 'pose',
          label: 'plugin.charfx.fx.pose.label',
          icon: '🤸',
          appliesToKinds: ['character'],
          command: 'charfx',
          targetParams: { character: { id: '$id' } },
          fanout: 'preset',
        },
      ],
    },
    authorUsage: [
      'Script commands:',
      '  [charfx <actor id> hop|nod|shake|swing duration=0.4] — a pose gesture on a character (hop / nod / shake / swing)',
      '  [move <actor id> to=left|center|right time=0.5] — slide a character to another stage slot',
    ],
  },
  {
    id: BUNDLED('choicefx'),
    name: 'plugin.choicefx.name',
    description: 'plugin.choicefx.desc',
    version: '1.0.0',
    engine: ENGINE_RANGE,
    entries: { engine: HOST_REGISTRY },
    permissions: [],
    contributes: { hooks: ['onChoices'] },
    authorUsage: [
      'No markup — applies automatically once enabled:',
      '  every choice button slides in one by one and shines on hover; the author writes nothing.',
    ],
  },
  {
    id: BUNDLED('screenfx'),
    name: 'plugin.screenfx.name',
    description: 'plugin.screenfx.desc',
    version: '1.0.0',
    engine: ENGINE_RANGE,
    entries: { engine: HOST_REGISTRY },
    permissions: ['stage.write'],
    contributes: {
      commands: SCREENFX_COMMANDS,
      effects: [
        {
          name: 'shake',
          label: 'plugin.screenfx.fx.shake.label',
          icon: '💥',
          appliesToKinds: ['camera', 'character', 'sprite'],
          command: 'shake',
          targetParams: OBJECT_TARGETS,
        },
        { name: 'flash', label: 'plugin.screenfx.fx.flash.label', icon: '⚡', appliesToKinds: ['screen'], command: 'flash' },
        { name: 'transout', label: 'plugin.screenfx.fx.transout.label', icon: '🌒', appliesToKinds: ['screen'], command: 'transout' },
        { name: 'transin', label: 'plugin.screenfx.fx.transin.label', icon: '🌔', appliesToKinds: ['screen'], command: 'transin' },
      ],
    },
    authorUsage: [
      'Script commands:',
      '  [shake strength=12 duration=0.45 target=screen|<actor id>] — shake the camera or a character',
      '  [flash color=#fff duration=0.4] — a full-screen flash',
      '  [transout type=wipe|circle|blinds dir=right duration=0.6 color=#000000] — cover the screen with a shaped transition (then change the scene)',
      '  [transin type=wipe|circle|blinds dir=right duration=0.6 color=#000000] — reveal the screen with the shape played backwards',
    ],
  },
  {
    id: BUNDLED('objectfx'),
    name: 'plugin.objectfx.name',
    description: 'plugin.objectfx.desc',
    version: '1.0.0',
    engine: ENGINE_RANGE,
    entries: { engine: HOST_REGISTRY },
    permissions: ['stage.write'],
    contributes: {
      commands: OBJECTFX_COMMANDS,
      effects: [
        { name: 'fade', label: 'plugin.objectfx.fx.fade.label', icon: '🌗', appliesToKinds: ['camera', 'character', 'sprite'], command: 'fade', targetParams: OBJECT_TARGETS, fanout: 'dir' },
        { name: 'scale', label: 'plugin.objectfx.fx.scale.label', icon: '🔍', appliesToKinds: ['camera', 'character', 'sprite'], command: 'scale', targetParams: OBJECT_TARGETS },
        { name: 'opacity', label: 'plugin.objectfx.fx.opacity.label', icon: '👻', appliesToKinds: ['camera', 'character', 'sprite'], command: 'opacity', targetParams: OBJECT_TARGETS },
        { name: 'visibility', label: 'plugin.objectfx.fx.visibility.label', icon: '🙈', appliesToKinds: ['camera', 'character', 'sprite'], command: 'visibility', targetParams: OBJECT_TARGETS, fanout: 'vis' },
        {
          name: 'layer',
          label: 'plugin.objectfx.fx.layer.label',
          icon: '🔼',
          appliesToKinds: ['character', 'sprite'],
          command: 'layer',
          targetParams: { character: OBJECT_TARGETS.character, sprite: OBJECT_TARGETS.sprite },
          fanout: 'layer',
        },
      ],
    },
    authorUsage: [
      'Script commands:',
      '  [fade target=screen|<id> kind=character|sprite dir=in|out duration=0.5] — fade an object in or out',
      '  [scale target=… to=1.2 duration=0.4] — scale an object (on the camera: zoom)',
      '  [opacity target=… to=0.5] — set an object\'s opacity',
      '  [visibility target=… vis=hide|show] — hide or show an object',
      '  [layer target=<id> kind=character|sprite layer=front|world] — lift an object in front of the dialogue box, or return it to the stage',
    ],
  },
  {
    id: BUNDLED('spriteanim'),
    name: 'plugin.spriteanim.name',
    description: 'plugin.spriteanim.desc',
    version: '1.0.0',
    engine: ENGINE_RANGE,
    entries: { engine: HOST_REGISTRY },
    permissions: ['stage.write'],
    contributes: {
      objectKinds: [{ id: 'sprite', label: 'plugin.spriteanim.kind.sprite', transformable: true, icon: '🎞️' }],
      commands: SPRITEANIM_COMMANDS,
    },
    authorUsage: [
      'Script commands:',
      '  [sprite <id> <sheet> frames=8 fps=12 loop=true at=center height=30 y=0 scale=1 rotation=0] — play a single-row sprite sheet as a frame loop; y / scale / rotation seed the resting pose',
      '  [hidesprite <id> fade=0.3] — remove the sprite',
    ],
  },
  {
    id: BUNDLED('voicefx'),
    name: 'plugin.voicefx.name',
    description: 'plugin.voicefx.desc',
    version: '1.0.0',
    engine: ENGINE_RANGE,
    entries: { engine: HOST_REGISTRY },
    // Reads the voice channel volume / a playing clip to yield; synthesizes its own blip.
    permissions: ['audio.play'],
    contributes: {
      hooks: ['onReveal'],
      // The actor's pitch rides on the actor declaration as this plugin's field
      // ([actors.yuki] voice = 360 / [actor yuki voice=360]) — no engine type.
      actorFields: [{ key: 'voice', type: 'number', label: 'plugin.voicefx.field.voice' }],
      config: [
        { key: 'enabled', type: 'boolean', default: true, label: 'plugin.voicefx.cfg.enabled', scope: 'player' },
        { key: 'level', type: 'number', default: 1, min: 0, max: 1, step: 0.05, label: 'plugin.voicefx.cfg.level', scope: 'player' },
        { key: 'wobble', type: 'number', default: 0.06, min: 0, max: 0.3, step: 0.01, label: 'plugin.voicefx.cfg.wobble' },
      ],
    },
    authorUsage: [
      'No markup — applies automatically once enabled:',
      '  a synthesized blip plays per typed character at the speaker\'s pitch ([actors.<id>] voice = Hz, or [actor id voice=Hz]); silent for lines that carry a real [voice] clip.',
      '  [plugins.voicefx] enabled / level (player-adjustable in the settings panel), wobble.',
    ],
  },
  {
    id: BUNDLED('voicerecord'),
    name: 'plugin.voicerecord.name',
    description: 'plugin.voicerecord.desc',
    version: '1.0.0',
    editor: EDITOR_RANGE,
    // Pure editor plugin: the per-line voice popover (record / import / offset).
    // The runtime side — [voice] playback next to the typewriter — is CORE, so
    // disabling this only removes the authoring UI; voiced lines keep playing.
    entries: { editor: HOST_REGISTRY },
    permissions: ['project.read', 'project.commit', 'assets.read', 'assets.write', 'ui.toast'],
    contributes: { lineActions: ['voice'] },
    authorUsage: [
      'Editor UI only, no script markup:',
      '  the dialogue line\'s voice button records or imports a clip; it writes the built-in [voice] command, played with the line (offset skips leading silence).',
    ],
  },
  {
    id: BUNDLED('animstudio'),
    name: 'plugin.animstudio.name',
    description: 'plugin.animstudio.desc',
    version: '1.0.0',
    engine: ENGINE_RANGE,
    editor: EDITOR_RANGE,
    entries: { engine: HOST_REGISTRY, editor: HOST_REGISTRY },
    permissions: ['stage.write', 'save.slice', 'project.read', 'project.commit', 'assets.read', 'ui.window', 'ui.toast'],
    // The authoring surface is the timeline's recording flow (frame editor,
    // loops, camera takes), not insertable commands — the serializer emits
    // [anim]/[eventframe]/[loopstart]/[loopstop] from first-class nodes, so
    // `commands` stays absent on purpose (same shape as abreplay).
    contributes: {
      saveSlice: true,
      nodeKinds: ['anim', 'eventframe', 'loopstart', 'loopstop'],
      stageTools: ['eventframe-editor'],
      objectMenu: ['loop'],
    },
    authorUsage: [
      'Recorded in the editor, hand-writable:',
      '  [eventframe dur=… kf=…] multi-object keyframe choreography (camera included); [loopstart] / [loopstop] background loops; [anim] a single-object clip.',
    ],
  },
  {
    id: BUNDLED('abreplay'),
    name: 'plugin.abreplay.name',
    description: 'plugin.abreplay.desc',
    version: '1.0.0',
    engine: ENGINE_RANGE,
    editor: EDITOR_RANGE,
    entries: { engine: HOST_REGISTRY, editor: HOST_REGISTRY },
    permissions: ['session.replay', 'project.read', 'project.commit', 'assets.read', 'ui.panel'],
    // The authoring surface is a manager panel, not commands: `Project.replays`
    // holds the segments; the serializer emits the [replaydef] preamble + end
    // markers this plugin's engine half executes.
    contributes: { panels: [{ id: 'replays', label: 'plugin.abreplay.panel' }] },
    authorUsage: [
      'No markup — panel-driven:',
      '  pick the A–B start and end nodes in the editor\'s replay panel; the exported game\'s menu shows a replay gallery, and passing the end in normal play unlocks the segment.',
    ],
  },
]

// Attach each plugin's own i18n catalog (registered under plugin:<id> by the
// editor/engine loaders). Kept out of the manifest literals above for readability.
for (const m of firstPartyManifests) m.messages = PLUGIN_MESSAGES[slug(m.id)]

const BY_ID = new Map(firstPartyManifests.map((m) => [m.id, m]))

/** Every first-party manifest — what a host registers next to
 *  {@link firstPartyPlugins} so the engine sees each declaration. (The in-game
 *  menu is built into the engine since 0.15; there is no menu manifest.) */
export const allFirstPartyManifests: readonly PluginManifest[] = firstPartyManifests

/** The first-party manifest for a short name or id; undefined for anything else. */
export function firstPartyManifest(nameOrId: string): PluginManifest | undefined {
  return BY_ID.get(resolveId(nameOrId))
}

/** Is `nameOrId` one of the first-party plugins (short name or id)? */
export function isFirstPartyPlugin(nameOrId: string): boolean {
  return BY_ID.has(resolveId(nameOrId))
}

/** All first-party CONTENT plugins as enabled refs — the default for a fresh
 *  project (the menu shell is not author-toggled, so it is not here). */
export function defaultFirstPartyRefs(): { id: string }[] {
  return firstPartyManifests.map((m) => ({ id: m.id }))
}

/** The commands the first-party content plugins contribute, by name — merge
 *  over core's BUILTIN_COMMAND_MAP (`commandRegistry(firstPartyManifests)`)
 *  for the serializer / editor registry. */
export function firstPartyCommandMap(): Record<string, CommandSchema> {
  return Object.fromEntries(firstPartyManifests.flatMap((m) => (m.contributes?.commands ?? []).map((c) => [c.name, c] as const)))
}
