import { departures } from '../course/departures.mjs'
import { laneGate, modeAt } from '../course/drill.mjs'
import { requireRule } from './deny.mjs'

function whole(course, drill, mode, lane, tick) {
  const gate = laneGate(course, drill, mode)
  return Array.from({ length: lane.duration }, (_, i) => tick + i).every(at => gate(lane, at))
}

export function sail(course, state, action, drill = null) {
  const lane = departures(course, state, drill).find(option => option.id === action.lane)
  requireRule(lane, 'lane', '当前站点无法进入这条航道。')
  const mode = modeAt(drill, state.tick)
  const route = course.lanes.find(item => item.id === action.lane)
  // 公布前两案共用同一可航集合；跨公布刻的航段也按所在实况逐刻检查整段。
  requireRule(whole(course, drill, mode, route, state.tick), 'tide',
    mode === 'both' ? '公布前必须在两种实况下都能整段走通。' : '整段航行必须落在开放潮窗内。')
  requireRule(lane.power <= state.power, 'power', '余电不足以完成这段航行。')
  return { at: lane.target, cost: lane.power, duration: lane.duration }
}
