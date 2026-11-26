import { departures } from '../course/departures.mjs'
import { requireRule } from './deny.mjs'

export function sail(course, state, action) {
  const lane = departures(course, state).find(option => option.id === action.lane)
  requireRule(lane, 'lane', '当前站点无法进入这条航道。')
  requireRule(lane.open, 'tide', '整段航行必须落在开放潮窗内。')
  requireRule(lane.power <= state.power, 'power', '余电不足以完成这段航行。')
  return { at: lane.target, cost: lane.power, duration: lane.duration }
}
