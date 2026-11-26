import { calendar } from '../course/calendar.mjs'
import { phase } from '../course/phase.mjs'
import { replay } from './replay.mjs'
import { options } from './options.mjs'
import { score } from './score.mjs'

export function briefing(course, actions) {
  const result = replay(course, actions)
  return { course, ...result, phase: phase(course, result.state.tick),
    calendar: calendar(course, result.state.tick), options: options(course, result.state), score: score(course, result.state) }
}
