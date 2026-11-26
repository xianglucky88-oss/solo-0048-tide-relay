import { requireRule } from './deny.mjs'

export function stationOrder(course, state, kind) {
  const station = course.stations.find(item => item.id === state.at)
  if (kind === 'tune') {
    requireRule(station.signal && !state.lit.includes(state.at), 'beacon', '这里没有尚待校准的信标。')
    requireRule(state.power >= 1, 'power', '校准至少需要一格电。')
    return { lit: [...state.lit, state.at], cost: 1, duration: station.tune }
  }
  requireRule(station.charge && state.power < course.capacity, 'charge', '这里无法充电，或电池已满。')
  return { cost: -Math.min(station.charge, course.capacity - state.power), duration: 1 }
}
