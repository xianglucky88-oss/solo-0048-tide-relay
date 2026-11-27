import { sail } from './sail.mjs'
import { stationOrder } from './station.mjs'
import { signalOrder } from './signal.mjs'
import { requireRule } from './deny.mjs'

export function apply(course, state, action) {
  requireRule(state.status === 'sailing', 'closed', '这一班已经结束。')
  let change = { duration: 1, cost: 0 }
  if (action.kind === 'sail') {
    change = sail(course, state, action)
  } else if (action.kind === 'signal') {
    requireRule(course.mode === 'relay', 'mode', '夜班只校准信标，不设收发联调。')
    change = signalOrder(course, state, action.band)
  } else if (action.kind === 'charge') {
    change = stationOrder(course, state, 'charge')
  } else if (action.kind === 'tune') {
    requireRule(course.mode === 'beacon', 'mode', '专项班不再校准信标，请设置收发。')
    change = stationOrder(course, state, 'tune')
  } else if (action.kind === 'finish') {
    requireRule(state.at === course.home, 'home', '必须返港后才能交班。')
    change.duration = 0
  }
  // 其余已校验的指令（如 wait）沿用默认：耗时一刻、不耗电。
  const tick = state.tick + change.duration
  requireRule(tick <= course.deadline, 'deadline', '这一指令会跨过交班时限。')
  const at = change.at ?? state.at
  const power = state.power - change.cost
  const status = action.kind === 'finish' ? 'returned' :
    tick < course.deadline ? 'sailing' : at === course.home ? 'returned' : 'expired'
  return {
    tick,
    at,
    power,
    lit: change.lit ?? state.lit,
    signals: change.signals ?? state.signals,
    status,
    log: [...state.log, {
      kind: action.kind,
      lane: action.lane,
      band: action.band ?? change.band,
      from: state.at,
      at,
      tick,
      power
    }]
  }
}
