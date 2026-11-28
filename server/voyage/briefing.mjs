import { calendar } from '../course/calendar.mjs'
import { phase } from '../course/phase.mjs'
import { describeDrill } from '../course/drill.mjs'
import { drillOptions } from '../course/exercises.mjs'
import { replay } from './replay.mjs'
import { options } from './options.mjs'
import { score } from './score.mjs'

export function briefing(course, actions, drill = null) {
  const result = replay(course, actions, drill)
  const revealed = drill && result.state.tick >= drill.ex.announce ? drill.actual : null
  return { course, ...result, phase: phase(course, result.state.tick),
    calendar: calendar(course, result.state.tick),
    options: options(course, result.state, drill),
    score: score(course, result.state),
    drill: describeDrill(course, drill, result.state.tick),
    actual: revealed,
    drillOptions: drillOptions() }
}
