import { sail } from './sail.mjs'
import { stationOrder } from './station.mjs'
import { requireRule } from './deny.mjs'

export function apply(course, state, action) {
  requireRule(state.status === 'sailing', 'closed', '这一班已经结束。')
  let change = { duration: 1, cost: 0 }
  if (action.kind === 'sail') change = sail(course, state, action)
  if (action.kind === 'charge' || action.kind === 'tune') change = stationOrder(course, state, action.kind)
  if (action.kind === 'finish') {
    requireRule(state.at === course.home, 'home', '必须返港后才能交班。')
    change.duration = 0
  }
  const tick = state.tick + change.duration
  requireRule(tick <= course.deadline, 'deadline', '这一指令会跨过交班时限。')
  const at = change.at ?? state.at
  const power = state.power - change.cost
  const status = action.kind === 'finish' ? 'returned' :
    tick < course.deadline ? 'sailing' : at === course.home ? 'returned' : 'expired'
  return { tick, at, power, lit: change.lit ?? state.lit, status,
    log: [...state.log, { kind: action.kind, lane: action.lane, from: state.at, at, tick, power }] }
}
