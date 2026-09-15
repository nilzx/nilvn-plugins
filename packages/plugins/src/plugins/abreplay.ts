import type { EnginePlugin } from '@nilvn/engine'

// A–B replay segments: the runtime half of Project.replays. The
// serializer emits a [replaydef] preamble plus a start label and an end marker
// per authored segment; this plugin owns the two commands. Segment REGISTRATION
// happens at parse time (engine.scanReplayDefs) so the gallery knows every
// segment regardless of where play starts — but the scan only runs while this
// plugin is installed (the gallery must not list segments whose unlock signal
// can never fire). The gallery UI itself lives in the menu plugin; the unlock
// set persists in localStorage per game. Runs on the `session.replay` capability.
export const abreplay: EnginePlugin = {
  id: 'app.nilvn.abreplay',
  permissions: ['session.replay'],

  commands: {
    // [replaydef id= title= label=] — segment declaration (serializer preamble).
    // Executing the preamble line is a no-op; parse-time scanning did the work.
    replaydef() {},

    // [replayend <segId>] — the A–B segment's end marker. In normal play, passing
    // it means the player has seen the segment through → fire the unlock signal.
    // While replaying THIS segment, the replay is over → hand control back to the
    // orchestrator (menu restores the stashed session) or finish. Passing another
    // segment's marker during a replay unlocks nothing (a replay is not "seeing"
    // the story).
    replayend(ctx) {
      const id = ctx.str(0)
      const replay = ctx.plugin.replay
      if (!id || !replay) return
      const replaying = replay.isReplaying()
      if (replaying === id) replay.end()
      else if (replaying === null) replay.fireSeen(id)
    },
  },
}
